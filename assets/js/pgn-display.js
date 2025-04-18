'use strict';

import { logDevelopment } from './logging.js';
import { renderBoard, flipBoard, cyclePieceSet } from './board-ui.js';
import {
  initializeGame, getCurrentFen, loadPgn, getPgnHeaders, getGameHistory,
  goToStart, goToPreviousMove, goToNextMove, goToEnd, getCurrentMoveIndex,
  goToMoveIndex,
  resetGameView
} from './game-logic.js';

// --- DOM Element Selectors ---
const flipBoardButton = $('#btn-flip-board');
const cyclePiecesButton = $('#btn-cycle-pieces');
const loadPgnButton = $('#btn-load-pgn');
const pgnInputArea = $('#pgn-input');
const chessboardContainer = $('#chessboard');
const resetButton = $('#btn-reset');
const savePgnButton = $('#btn-save-pgn');
const startButton = $('#btn-start');
const prevButton = $('#btn-prev');
const nextButton = $('#btn-next');
const endButton = $('#btn-end');
const pgnHeaderWhite = $('#pgn-header-white');
const pgnHeaderBlack = $('#pgn-header-black');
const pgnHeaderResult = $('#pgn-header-result');
const pgnHeaderEvent = $('#pgn-header-event');
const pgnHeaderDate = $('#pgn-header-date');
const pgnMovesList = $('#pgn-moves-list');

// fix PGN for development
const FIXPGN = true;

// --- Helper Functions for PGN Display ---

/**
 * Updates the PGN header display elements.
 * @param {object} headers - The headers object from chess.js (e.g., { White: '...', Black: '...' }).
 */
function displayPgnHeaders(headers) {
  logDevelopment("Updating PGN header display.", 'debug');
  pgnHeaderWhite.text(headers.White || 'N/A');
  pgnHeaderBlack.text(headers.Black || 'N/A');
  pgnHeaderResult.text(headers.Result || 'N/A');
  pgnHeaderEvent.text(headers.Event || 'N/A');
  pgnHeaderDate.text(headers.Date || 'N/A');
}

/**
 * Updates the PGN moves list display and adds highlighting capabilities.
 * @param {object[]} history - The verbose move history array from chess.js.
 */
function displayPgnMoves(history) {
  logDevelopment(`Updating PGN moves display with ${history.length} moves.`, 'debug');
  pgnMovesList.empty(); // Clear previous moves

  if (history.length === 0) {
    pgnMovesList.append(`<li class="list-group-item p-1" data-i18n="pgnViewer.noGameLoaded">No game loaded.</li>`);
    if (window.i18next && window.applyI18nToElement) {
      window.applyI18nToElement(pgnMovesList.children().last()[0]);
    }
    return;
  }

  let moveNumber = 1;
  let movePairIndex = 0;
  let fullMoveHtml = '';

  history.forEach((move, index) => {
    const moveHtml = `<span class="move ${move.color === 'w' ? 'white-move' : 'black-move'}" data-move-index="${index}">${move.san}</span>`;

    if (move.color === 'w') {
      if (fullMoveHtml) {
        pgnMovesList.append(`<li class="list-group-item p-1" data-move-pair-index="${movePairIndex}">${fullMoveHtml}</li>`);
        movePairIndex++;
      }
      fullMoveHtml = `<span class="move-number">${moveNumber}.</span> ${moveHtml}`;
      moveNumber++;
    } else {
      fullMoveHtml += ` ${moveHtml}`;
      pgnMovesList.append(`<li class="list-group-item p-1" data-move-pair-index="${movePairIndex}">${fullMoveHtml}</li>`);
      movePairIndex++;
      fullMoveHtml = '';
    }
  });

  if (fullMoveHtml) {
    pgnMovesList.append(`<li class="list-group-item p-1" data-move-pair-index="${movePairIndex}">${fullMoveHtml}</li>`);
  }

  highlightCurrentMove();
}


/**
 * Highlights the current move in the PGN moves list based on getCurrentMoveIndex().
 */
function highlightCurrentMove() {
  const currentIdx = getCurrentMoveIndex();
  logDevelopment(`Highlighting move index: ${currentIdx}`, 'debug');

  pgnMovesList.find('li').removeClass('active');
  pgnMovesList.find('span.move').removeClass('active-move');

  if (currentIdx === -1) {
    logDevelopment("At start, no move highlighted.", 'debug');
  } else {
    const targetMoveSpan = pgnMovesList.find(`span.move[data-move-index="${currentIdx}"]`);
    if (targetMoveSpan.length) {
      targetMoveSpan.addClass('active-move');
      const parentLi = targetMoveSpan.closest('li');
      parentLi.addClass('active');

      const listElement = pgnMovesList[0];
      const listItemElement = parentLi[0];
      if (listElement && listItemElement) {
        listItemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      logDevelopment(`Highlighted move SAN: ${targetMoveSpan.text()}`, 'debug');
    } else {
      logDevelopment(`Could not find move span for index ${currentIdx} to highlight.`, 'warn');
    }
  }
}

/**
 * Updates the board display and highlights the current move.
 * @param {string|null} fen - The FEN string to render. If null, indicates an error or no change.
 */
function updateBoardAndHighlight(fen) {
  if (fen && chessboardContainer.length) {
    renderBoard(chessboardContainer[0], fen);
    highlightCurrentMove();
  } else if (!fen) {
    logDevelopment("Navigation function returned null, no UI update.", 'debug');
  }
}

/**
 * Clears the PGN display areas (headers, moves, input).
 */
function clearPgnDisplay() {
  logDevelopment("Clearing PGN display areas.", 'debug');
  displayPgnHeaders({});
  displayPgnMoves([]);
  pgnInputArea.val('');
}

/**
 * Placeholder function for saving PGN to the current file.
 */
function savePgnToFile() {
  logDevelopment("Save PGN button clicked - functionality not yet implemented.", 'info');
  // Assuming showNotification is globally available or imported elsewhere if needed
  if (window.showNotification) {
    showNotification("Save PGN functionality is not yet implemented.", 'info');
  }
  // TODO: Implement logic
}

// --- Event Listener Setup ---

export function initializePgnDisplayListeners() {
  logDevelopment("Initializing PGN display listeners.");

  // Flip board button listener
  flipBoardButton.click(function() {
    const STARTING_FEN_WHITE_TURN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const STARTING_FEN_BLACK_TURN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

    if (getCurrentFen() === STARTING_FEN_WHITE_TURN) {
      logDevelopment('Current: Start White. Setting Start Black.');
      initializeGame(STARTING_FEN_BLACK_TURN);
    } else if (getCurrentFen() === STARTING_FEN_BLACK_TURN) {
      logDevelopment('Current: Start Black. Setting Start White.');
      initializeGame(STARTING_FEN_WHITE_TURN);
    }
    logDevelopment("Flip board button clicked.");
    flipBoard();
    // Re-render after potential game state change and flip
    updateBoardAndHighlight(getCurrentFen());
  });

  // Cycle piece set button listener
  cyclePiecesButton.click(function() {
    logDevelopment("Cycle piece set button clicked.");
    cyclePieceSet();
    // Re-render after cycling pieces to apply the new set
    updateBoardAndHighlight(getCurrentFen());
  });

  // Load PGN from text area button listener
  loadPgnButton.click(function() {
    logDevelopment("Load PGN button clicked.");
    const pgnExample = [
      '[Event "Casual Game"]',
      '[Site "Berlin GER"]',
      '[Date "1852 stardom"]', // Corrected typo
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
        logDevelopment("PGN loaded successfully.");
        const headers = getPgnHeaders();
        const history = getGameHistory();
        displayPgnHeaders(headers);
        displayPgnMoves(history);
        updateBoardAndHighlight(getCurrentFen()); // Render initial board and highlight

        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.pgnLoadSuccess', 'PGN loaded successfully.'), 'success', i18next.t('notification.titleSuccess', 'Success'));
        }
      } else {
        displayPgnHeaders({});
        displayPgnMoves([]);
        logDevelopment("Failed to load PGN (loadPgn returned false).", 'warn');
        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.pgnLoadError', 'Could not load game from PGN text.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
        }
      }
    } catch (error) {
      const errorMessage = error.message || (window.i18next ? i18next.t('notification.pgnLoadUnknownError', 'Unknown error during PGN loading.') : 'Unknown error during PGN loading.');
      logDevelopment(`Error loading PGN: ${errorMessage}`, 'error');
      console.error("Error loading PGN:", error);
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.pgnLoadErrorDetail', 'Error loading PGN: {{error}}', { error: errorMessage }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      }
    }
  });

  // --- Control Button Listeners ---
  resetButton.click(function() {
    logDevelopment("Reset button clicked.");
    if (resetGameView()) {
      clearPgnDisplay();
      updateBoardAndHighlight(getCurrentFen());
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.gameResetSuccess', 'Game reset to starting position.'), 'success', i18next.t('notification.titleSuccess', 'Success'));
      }
    } else {
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.gameResetError', 'Failed to reset game.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      }
    }
  });

  savePgnButton.click(function() {
    savePgnToFile();
  });

  // --- Navigation Button Listeners ---
  startButton.click(function() {
    logDevelopment("Start button clicked.");
    const newFen = goToStart();
    updateBoardAndHighlight(newFen);
  });

  prevButton.click(function() {
    logDevelopment("Previous button clicked.");
    const newFen = goToPreviousMove();
    updateBoardAndHighlight(newFen);
  });

  nextButton.click(function() {
    logDevelopment("Next button clicked.");
    const newFen = goToNextMove();
    updateBoardAndHighlight(newFen);
  });

  endButton.click(function() {
    logDevelopment("End button clicked.");
    const newFen = goToEnd();
    updateBoardAndHighlight(newFen);
  });

  // --- Move List Click Listener ---
  pgnMovesList.on('click', 'span.move', function() {
    const clickedIndex = $(this).data('move-index');
    if (typeof clickedIndex !== 'undefined') {
      logDevelopment(`Move span clicked, navigating to index: ${clickedIndex}`);
      const newFen = goToMoveIndex(parseInt(clickedIndex, 10));
      updateBoardAndHighlight(newFen);
    }
  });

  // Initial render on load
  if (chessboardContainer.length) {
    logDevelopment("Rendering initial chessboard from game state in pgn-display.");
    updateBoardAndHighlight(getCurrentFen()); // Use the helper to render and highlight
    // Also display initial headers and moves if a game is loaded by default
    const initialHeaders = getPgnHeaders();
    const initialHistory = getGameHistory();
    if (initialHistory.length > 0 || Object.keys(initialHeaders).length > 0) {
      displayPgnHeaders(initialHeaders);
      displayPgnMoves(initialHistory);
    } else {
      // Ensure display is cleared if no game is loaded initially
      clearPgnDisplay();
    }
  } else {
    logDevelopment("Error: Chessboard container element not found!", 'error');
  }
}
