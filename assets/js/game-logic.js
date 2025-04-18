'use strict';
import { logDevelopment } from './logging.js';
import { Chess } from './lib/chess-1.2.0.min.js';
import { getIsBoardFlipped } from './board-ui.js';

let chess = null; // The chess.js instance for the *current* position
let initialFen = null; // FEN of the starting position of the loaded PGN
let moveHistory = []; // Array to store the sequence of moves (verbose objects) from the loaded PGN
let currentMoveIndex = -1; // -1 indicates the initial position before the first move

/**
 * Initializes the chess game logic.
 * Loads the starting position or a specific FEN.
 * @param {string} [fen=null] - Optional FEN string to load. Defaults to starting position.
 */
export function initializeGame(fen = null) {
  try {
    const startFen = fen || new Chess().fen(); // Default to standard start if no FEN provided
    chess = new Chess(startFen);
    initialFen = startFen; // Store the initial FEN
    moveHistory = []; // Clear history
    currentMoveIndex = -1; // Reset index
    logDevelopment(`Game initialized. Initial FEN: ${initialFen}`);
    return true;
  } catch (error) {
    logDevelopment(`Error initializing chess.js: ${error}`, 'error');
    initialFen = null;
    moveHistory = [];
    currentMoveIndex = -1;
    chess = null;
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
  return chess.isCheckmate() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isDraw();
}


// --- Helper function to check game status and show notifications ---
function checkGameStatus() {
  if (!chess) return;

  let messageKey = null;
  let messageOptions = {};
  let notificationType = 'info'; // Default type

  if (chess.isCheckmate()) {
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

  } else if (chess.isStalemate()) {
    messageKey = 'notification.stalemate';
    notificationType = 'warning';
  } else if (chess.isThreefoldRepetition()) {
    messageKey = 'notification.threefoldRepetition';
    notificationType = 'warning';
  } else if (chess.isDraw()) {
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
    chess = new Chess();
    chess.loadPgn(pgnString);

    initialFen = chess.getHeaders().FEN || new Chess().fen();
    moveHistory = chess.history({ verbose: true }) || [];
    currentMoveIndex = -1;

    logDevelopment(`PGN loaded successfully. Initial FEN: ${initialFen}. History length: ${moveHistory.length}. Current index: ${currentMoveIndex}. Main chess instance now holds the full game, reset to start`);
    return true;
  } catch (error) {
    logDevelopment(`Error loading PGN: ${error}`, 'error');
    initializeGame();
    return false;
  }
}

/**
 * Gets the PGN headers.
 * @returns {object} An object containing the PGN headers (e.g., { White: '...', Black: '...' }). Returns empty object if game not loaded.
 */
export function getPgnHeaders() {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return {};
  }
  return chess.getHeaders() || {}; // chess.js header() returns the headers object
}

/**
 * Gets the game history (list of moves).
 * Uses the verbose option to get detailed move objects.
 * @returns {object[]} An array of move objects from chess.js history. Returns empty array if game not loaded.
 */
export function getGameHistory() {
  if (!chess) {
    logDevelopment('Error: Game not initialized.', 'error');
    return [];
  }
  // Get history with verbose objects to potentially use more info later
  // Return the stored history, not the history of the potentially modified 'chess' instance
  return moveHistory;
}


/**
 * Resets the game state to a specific move index in the history.
 * Updates the internal chess object to reflect the position at that index.
 * @param {number} index - The target move index (-1 for initial position).
 * @returns {string|null} The FEN of the position at the target index, or null on error.
 */
export function goToMoveIndex(index) {
  if (!initialFen) return null;
  if (index < -1 || index >= moveHistory.length) return null;

  chess.reset(); // use chess.load(initialFen) if starting FEN is not standard

  for (let i = 0; i <= index; i++) {
    if (!chess.move(moveHistory[i].san)) return null;
  }
  currentMoveIndex = index;
  return chess.fen();
}

// --- Navigation Functions ---

/**
 * Goes to the starting position of the game.
 * @returns {string|null} The FEN of the starting position or null on error.
 */
export function goToStart() {
  logDevelopment('Navigating to start.');
  return goToMoveIndex(-1);
}

/**
 * Goes to the previous move.
 * @returns {string|null} The FEN of the previous position or null if already at start or on error.
 */
export function goToPreviousMove() {
  if (currentMoveIndex < 0) {
    logDevelopment('Already at the start.');
    return null; // Cannot go back further
  }
  logDevelopment(`Navigating to previous move (index ${currentMoveIndex - 1}).`);
  return goToMoveIndex(currentMoveIndex - 1);
}

/**
 * Goes to the next move.
 * @returns {string|null} The FEN of the next position or null if already at the end or on error.
 */
export function goToNextMove() {
  if (currentMoveIndex >= moveHistory.length - 1) {
    logDevelopment('Already at the end.');
    return null; // Cannot go forward further
  }
  logDevelopment(`Navigating to next move (index ${currentMoveIndex + 1}).`);
  return goToMoveIndex(currentMoveIndex + 1);
}

/**
 * Goes to the final position of the game.
 * @returns {string|null} The FEN of the final position or null on error.
 */
export function goToEnd() {
  logDevelopment('Navigating to end.');
  return goToMoveIndex(moveHistory.length - 1);
}

/**
 * Gets the current move index. Useful for highlighting the current move in the UI.
 * @returns {number} The current move index (-1 for start).
 */
export function getCurrentMoveIndex() {
  return currentMoveIndex;
}

/**
 * Resets the entire game view state to the standard starting position.
 * Clears loaded PGN data (history, headers, initial FEN).
 * @returns {boolean} True if reset was successful, false otherwise.
 */
export function resetGameView() {
  logDevelopment('Resetting game view to initial state.');
  try {
    // Re-initialize with the default starting position
    initializeGame(); // This already handles setting chess, initialFen, history, index
    if (chess) {
      logDevelopment('Game view reset successfully.');
      return true;
    } else {
      logDevelopment('Failed to reset game view (chess object is null after re-initialization).', 'error');
      return false;
    }
  } catch (error) {
    logDevelopment(`Error during game view reset: ${error}`, 'error');
    return false;
  }
}

// --- End Navigation Functions ---
