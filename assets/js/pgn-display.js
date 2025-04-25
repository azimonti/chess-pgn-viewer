'use strict';

import { renderBoard, flipBoard, cyclePieceSet } from './board-ui.js?id=8bbc53';
import { initializeGame, getCurrentFen, loadPgn, getPgnHeaders, getGameHistory, getGameComments, goToStart, goToPreviousMove, goToNextMove, goToEnd, getCurrentMoveIndex, goToMoveIndex, resetGameView } from './game-logic.js?id=8bbc53';
import { updatePgnFileDetailsUI } from './file-management-ui.js?id=8bbc53';
import { setActiveFile } from './storage/storage.js?id=8bbc53';

// --- DOM Element Selectors ---
const flipBoardButton = $('#btn-flip-board');
const cyclePiecesButton = $('#btn-cycle-pieces');
const loadPgnButton = $('#btn-load-pgn');
const pgnInputArea = $('#pgn-input');
const chessboardContainer = $('#chessboard');
const resetButton = $('#btn-reset');
const startButton = $('#btn-start');
const prevButton = $('#btn-prev');
const nextButton = $('#btn-next');
const endButton = $('#btn-end');
const pgnHeaderWhite = $('#pgn-header-white');
const pgnHeaderBlack = $('#pgn-header-black');
const pgnHeaderResult = $('#pgn-header-result');
const pgnHeaderEvent = $('#pgn-header-event');
const pgnHeaderDate = $('#pgn-header-date');
const pgnMovesParagraph = $('#pgn-moves-paragraph');

// fix PGN for development
const FIXPGN = false;

// --- Helper Functions for PGN Display ---

/**
 * Updates the PGN header display elements.
 * @param {object} headers - The headers object from chess.js (e.g., { White: '...', Black: '...' }).
 */
export function displayPgnHeaders(headers) { // Added export
  pgnHeaderWhite.text(headers.White || 'N/A');
  pgnHeaderBlack.text(headers.Black || 'N/A');
  pgnHeaderResult.text(headers.Result || 'N/A');
  pgnHeaderEvent.text(headers.Event || 'N/A');
  pgnHeaderDate.text(headers.Date || 'N/A');
}

/**
 * Helper function to simplify a FEN string for use as a key in the comments map.
 * Removes move counters (halfmove clock and fullmove number).
 * @param {string} fen - The full FEN string.
 * @returns {string} The simplified FEN string (board, turn, castling, en passant).
 */
function simplifyFenForKey(fen) {
  if (!fen) return '';
  const parts = fen.split(' ');
  // Keep the first 4 parts: board, turn, castling rights, en passant target square
  if (parts.length >= 4) {
    return parts.slice(0, 4).join(' ');
  }
  // Fallback for incomplete FENs, though unlikely here
  return fen;
}


/**
 * Updates the PGN moves paragraph display, including comments and highlighting capabilities.
 * @param {object[]} history - The verbose move history array from chess.js.
 */
export function displayPgnMoves(history) { // Added export
  pgnMovesParagraph.empty(); // Clear previous moves
  const comments = getGameComments(); // Get comments array [{fen: ..., comment: ...}, ...]
  // Create map using simplified FENs as keys for more robust matching
  const commentsMap = new Map(comments.map(c => [simplifyFenForKey(c.fen), c.comment]));

  if (history.length === 0) {
    pgnMovesParagraph.append(`<span data-i18n="pgnViewer.noGameLoaded">No game loaded.</span>`);
    if (window.i18next && window.applyI18nToElement) {
      window.applyI18nToElement(pgnMovesParagraph.children().last()[0]);
    }
    return;
  }

  let moveNumber = 1;

  history.forEach((move, index) => {
    // Add move number for white's move
    if (move.color === 'w') {
      pgnMovesParagraph.append(`<span class="pgn-move-number">${moveNumber}.</span> `);
    }

    // Add the move itself
    const moveSpan = $(`<span class="pgn-move" data-move-index="${index}">${move.san}</span>`);
    pgnMovesParagraph.append(moveSpan);
    pgnMovesParagraph.append(' '); // Add space after the move

    // Add comment if present (lookup using simplified FEN *before* the move)
    const simplifiedFenBefore = simplifyFenForKey(move.before);
    const commentText = commentsMap.get(simplifiedFenBefore);
    if (commentText) {
      const trimmedComment = commentText.trim();
      // Remove potential curly braces from the comment text itself
      const displayComment = trimmedComment.replace(/^\{|\}$/g, '').trim();
      const commentSpan = $(`<span class="pgn-comment">${displayComment}</span>`);
      // Simple heuristic: add a break before longer comments or those with internal newlines
      if (trimmedComment.length > 50 || trimmedComment.includes('\n')) {
        pgnMovesParagraph.append('<br>');
      }
      pgnMovesParagraph.append(commentSpan);
      pgnMovesParagraph.append(' '); // Add space after the comment
    }

    // Increment move number after black's move
    if (move.color === 'b') {
      moveNumber++;
    }
  });

  // Add the game result if available in the history (last item often has it)
  const lastMove = history[history.length - 1];
  if (lastMove && lastMove.flags && lastMove.flags.includes('k')) { // Checkmate flag
    const result = getPgnHeaders().Result;
    if (result && result !== '*') {
      pgnMovesParagraph.append(`<span class="pgn-result">${result}</span>`);
    }
  } else {
    const result = getPgnHeaders().Result;
    if (result && result !== '*') {
      pgnMovesParagraph.append(`<span class="pgn-result">${result}</span>`);
    }
  }


  highlightCurrentMove();
}


/**
 * Highlights the current move in the PGN moves paragraph based on getCurrentMoveIndex().
 */
function highlightCurrentMove() {
  const currentIdx = getCurrentMoveIndex();

  // Remove previous highlight
  pgnMovesParagraph.find('span.pgn-move').removeClass('active-move');

  if (currentIdx === -1) {
    // Optionally scroll to top when at start
    pgnMovesParagraph.scrollTop(0);
  } else {
    const targetMoveSpan = pgnMovesParagraph.find(`span.pgn-move[data-move-index="${currentIdx}"]`);
    if (targetMoveSpan.length) {
      targetMoveSpan.addClass('active-move');

      // Scroll the container to make the active move visible
      const containerElement = pgnMovesParagraph[0];
      const moveElement = targetMoveSpan[0];
      if (containerElement && moveElement) {
        // Calculate position relative to the container
        const containerRect = containerElement.getBoundingClientRect();
        const moveRect = moveElement.getBoundingClientRect();
        const scrollOffset = moveRect.top - containerRect.top + containerElement.scrollTop - (containerElement.clientHeight / 3); // Aim for 1/3 down

        containerElement.scrollTo({
          top: scrollOffset,
          behavior: 'smooth'
        });
      }
    } else {
      console.warn(`Could not find move span for index ${currentIdx} to highlight.`); // Replaced logDevelopment with console.warn
    }
  }
}

/**
 * Updates the board display and highlights the current move.
 * @param {string|null} fen - The FEN string to render. If null, indicates an error or no change.
 */
export function updateBoardAndHighlight(fen) { // Added export
  if (fen && chessboardContainer.length) {
    renderBoard(chessboardContainer[0], fen);
    highlightCurrentMove();
  }
}

/**
 * Clears the PGN display areas (headers, moves, input).
 */
function clearPgnDisplay() {
  displayPgnHeaders({});
  displayPgnMoves([]);
  pgnInputArea.val('');
}

// --- Event Listener Setup ---

export function initializePgnDisplayListeners() {

  // Flip board button listener
  flipBoardButton.click(function() {
    const STARTING_FEN_WHITE_TURN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const STARTING_FEN_BLACK_TURN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

    if (getCurrentFen() === STARTING_FEN_WHITE_TURN) {
      initializeGame(STARTING_FEN_BLACK_TURN);
    } else if (getCurrentFen() === STARTING_FEN_BLACK_TURN) {
      initializeGame(STARTING_FEN_WHITE_TURN);
    }
    flipBoard();
    // Re-render after potential game state change and flip
    updateBoardAndHighlight(getCurrentFen());
  });

  // Cycle piece set button listener
  cyclePiecesButton.click(function() {
    cyclePieceSet();
    // Re-render after cycling pieces to apply the new set
    updateBoardAndHighlight(getCurrentFen());
  });

  // Load PGN from text area button listener
  loadPgnButton.click(function() {
    const pgnExample = [
      '[Event "Casual Game"]',
      '[Site "Berlin GER"]',
      '[Date "1852 stardom"]',
      '[EventDate "?"]',
      '[Round "?"]',
      '[Result "1-0"]',
      '[White "Adolf Anderssen"]',
      '[Black "Jean Dufresne"]',
      '[ECO "C52"]',
      '[WhiteElo "?"]',
      '[BlackElo "?"]',
      '[PlyCount "47"]',
      '',
      '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O',
      'd3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4',
      'Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6',
      'Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8',
      '23.Bd7+ Kf8 24.Bxe7# 1-0',
    ].join('\n');
    const pgnText = pgnInputArea.val().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const pgnToLoad = FIXPGN ? pgnExample : pgnText;

    if (!pgnToLoad && !FIXPGN) { // Check if pgnToLoad is empty only if not using FIXPGN
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.pgnInputEmpty', 'PGN input area is empty.'), 'info', i18next.t('notification.titleInfo', 'Info'));
      }
      return;
    }

    try {
      if (loadPgn(pgnToLoad)) {
        const headers = getPgnHeaders();
        const history = getGameHistory();
        displayPgnHeaders(headers);
        displayPgnMoves(history);
        updateBoardAndHighlight(getCurrentFen()); // Render initial board and highlight

        // remove the file contents as the pgn is loaded from the textarea
        updatePgnFileDetailsUI(null, null, true);

        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.pgnLoadSuccess', 'PGN loaded successfully.'), 'success', i18next.t('notification.titleSuccess', 'Success'));
        }
      } else {
        displayPgnHeaders({});
        displayPgnMoves([]);
        console.warn("Failed to load PGN (loadPgn returned false)."); // Replaced logDevelopment with console.warn
        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.pgnLoadError', 'Could not load game from PGN text.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
        }
      }
    } catch (error) {
      const errorMessage = error.message || (window.i18next ? i18next.t('notification.pgnLoadUnknownError', 'Unknown error during PGN loading.') : 'Unknown error during PGN loading.');
      console.error(`Error loading PGN: ${errorMessage}`, error); // Replaced logDevelopment with console.error
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.pgnLoadErrorDetail', 'Error loading PGN: {{error}}', { error: errorMessage }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      }
    }
  });

  // --- Control Button Listeners ---
  resetButton.click(function() {
    if (resetGameView()) {
      clearPgnDisplay();
      updateBoardAndHighlight(getCurrentFen());
      setActiveFile('/9ed81f9981394.pgn'); // reset the active file to random string
      updatePgnFileDetailsUI(null, null, true); // remove games contents if loaded
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.gameResetSuccess', 'Game reset to starting position.'), 'success', i18next.t('notification.titleSuccess', 'Success'));
      }
    } else {
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.gameResetError', 'Failed to reset game.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      }
    }
  });

  // --- Navigation Button Listeners ---
  startButton.click(function() {
    const newFen = goToStart();
    updateBoardAndHighlight(newFen);
  });

  prevButton.click(function() {
    const newFen = goToPreviousMove();
    updateBoardAndHighlight(newFen);
  });

  nextButton.click(function() {
    const newFen = goToNextMove();
    updateBoardAndHighlight(newFen);
  });

  endButton.click(function() {
    const newFen = goToEnd();
    updateBoardAndHighlight(newFen);
  });

  // --- Move Paragraph Click Listener ---
  pgnMovesParagraph.on('click', 'span.pgn-move', function() { // Changed target
    const clickedIndex = $(this).data('move-index');
    if (typeof clickedIndex !== 'undefined') {
      const newFen = goToMoveIndex(parseInt(clickedIndex, 10));
      updateBoardAndHighlight(newFen);
    }
  });
  //  clearPgnDisplay(); // This clears headers and calls displayPgnMoves([])

}
