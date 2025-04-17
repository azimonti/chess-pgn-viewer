import { logDevelopment } from './logging.js';
import { Chess } from './lib/chess-0.13.4.min.js';
import { getIsBoardFlipped } from './board-ui.js'; 

let chess = null; // The chess.js instance

/**
 * Initializes the chess game logic.
 * Loads the starting position or a specific FEN.
 * @param {string} [fen=null] - Optional FEN string to load. Defaults to starting position.
 */
export function initializeGame(fen = null) {
  try {
    chess = fen ? new Chess(fen) : new Chess();
    logDevelopment(`Game initialized. FEN: ${chess.fen()}`);
    return true;
  } catch (error) {
    logDevelopment(`Error initializing chess.js: ${error}`, 'error');
    chess = null; // Ensure chess is null if initialization fails
    return false;
  }
}

/**
 * Attempts to make a move in the game.
 * Handles promotion automatically (defaults to Queen).
 * @param {string} fromSq - The starting square (e.g., 'e2').
 * @param {string} toSq - The destination square (e.g., 'e4').
 * @returns {object|null} The move object if successful, null otherwise.
 */
export function makeMove(fromSq, toSq) {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return null;
  }
  try {
    // chess.js requires the 'promotion' parameter for pawn promotion moves
    const moveOptions = {
      from: fromSq,
      to: toSq,
      promotion: 'q' // Default to queen promotion for simplicity for now
    };
    const moveResult = chess.move(moveOptions);

    if (moveResult) {
      logDevelopment(`Move made: ${fromSq}-${toSq}. New FEN: ${chess.fen()}`);
      // --- Check game end conditions ---
      checkGameStatus(); // Call helper function
      // --- End Check ---
    } else {
      logDevelopment(`Invalid move attempted: ${fromSq}-${toSq}`, 'warn');
    }
    return moveResult; // Returns the move object or null if invalid
  } catch (error) {
    logDevelopment(`Error making move ${fromSq}-${toSq}: ${error}`, 'error');
    return null;
  }
}

/**
 * Gets the current game state as a FEN string.
 * @returns {string|null} The FEN string or null if game not initialized.
 */
export function getCurrentFen() {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return null;
  }
  return chess.fen();
}

/**
 * Gets the piece at a specific square.
 * @param {string} square - The square identifier (e.g., 'e4').
 * @returns {object|null} Piece object ({ type: 'p', color: 'w' }) or null if empty/invalid.
 */
export function getPieceAt(square) {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return null;
  }
  return chess.get(square);
}

/**
 * Gets a list of valid moves for a given square.
 * @param {string} square - The square identifier (e.g., 'e4').
 * @returns {string[]} An array of valid destination squares (e.g., ['e5', 'f5']). Returns empty array if no valid moves.
 */
export function getValidMoves(square) {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return [];
  }
  const moves = chess.moves({ square: square, verbose: true });
  // Extract only the 'to' squares from the verbose move objects
  return moves.map(move => move.to);
}

/**
 * Checks whose turn it is.
 * @returns {string|null} 'w' for white, 'b' for black, or null if game not initialized.
 */
export function getTurn() {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return null;
  }
  return chess.turn();
}

/**
 * Checks if the game is over (checkmate, stalemate, draw).
 * @returns {boolean} True if the game is over, false otherwise.
 */
export function isGameOver() {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return false; // Or handle as appropriate
  }
  // Use the correct method names from chess.js
  return chess.in_checkmate() || chess.in_stalemate() || chess.in_threefold_repetition() || chess.in_draw();
}


// --- Helper function to check game status and show notifications ---
function checkGameStatus() {
  if (!chess) return;

  let messageKey = null;
  let messageOptions = {};
  let notificationType = 'info'; // Default type

  if (chess.in_checkmate()) { // Corrected method name
    const winner = chess.turn() === 'b' ? 'White' : 'Black'; // Winner is the one whose turn it ISN'T
    messageKey = winner === 'White' ? 'notification.checkmateWhiteWins' : 'notification.checkmateBlackWins';

    // Determine notification type based on board orientation
    const boardFlipped = getIsBoardFlipped(); // Use the imported function
    const whiteAtBottom = !boardFlipped;

    if (winner === 'White') {
      notificationType = whiteAtBottom ? 'success' : 'error';
    } else { // Black wins
      notificationType = whiteAtBottom ? 'error' : 'success';
    }

  } else if (chess.in_stalemate()) { // Corrected method name
    messageKey = 'notification.stalemate';
    notificationType = 'warning';
  } else if (chess.in_threefold_repetition()) { // Corrected method name
    messageKey = 'notification.threefoldRepetition';
    notificationType = 'warning';
  } else if (chess.in_draw()) { // Corrected method name (Catches insufficient material, 50-move rule besides the above)
    messageKey = 'notification.draw';
    notificationType = 'warning';
  }

  if (messageKey) {
    // Use i18next for translation (assuming global 'i18next' object)
    const message = i18next.t(messageKey, messageOptions);
    const title = i18next.t('notification.gameOverTitle'); // Get localized title
    // Call global function directly with title and 0 duration
    window.showNotification(message, notificationType, title, 0);
    logDevelopment(`Game over notification: ${title} - ${message} (Type: ${notificationType})`);
  }
}

/**
 * Loads a game from a PGN string.
 * Uses the chess.js library's load_pgn method.
 * @param {string} pgnString - The PGN text to load.
 * @returns {boolean} True if the PGN was loaded successfully, false otherwise.
 */
export function loadPgn(pgnString) {
  if (!chess) {
    // Attempt to initialize if not already done
    if (!initializeGame()) {
      logDevelopment('Error: Cannot load PGN, game initialization failed.', 'error');
      return false;
    }
  }
  try {
    // Normalize newlines and trim whitespace
    const normalizedPgn = pgnString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    // Use default newline handling, but explicitly set sloppy to false
    const options = { sloppy: false };
    logDevelopment(`Attempting to load PGN. Trimmed & Normalized text (first 100 chars): ${normalizedPgn.substring(0, 100)}`, 'debug'); // Log input
    const success = chess.load_pgn(normalizedPgn, options); // Added options with sloppy: false
    logDevelopment(`chess.load_pgn returned: ${success}. Current FEN after attempt: ${chess.fen()}`, 'debug'); // Log output and state
    if (success) {
      logDevelopment(`PGN loaded successfully. First move: ${chess.history()[0] || 'N/A'}. Current FEN: ${chess.fen()}`);
      // Optionally reset board orientation or other UI elements if needed upon new PGN load
    } else {
      logDevelopment('chess.load_pgn returned false. PGN might be invalid or empty.', 'warn');
    }
    return success;
  } catch (error) {
    logDevelopment(`Error loading PGN: ${error}`, 'error');
    // Potentially re-initialize to a default state if loading fails badly
    // initializeGame(); // Uncomment if you want to reset to start on error
    return false;
  }
}

// Add more functions as needed (e.g., undoMove, getHistory, etc.)
