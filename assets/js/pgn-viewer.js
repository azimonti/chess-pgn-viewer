/* NOTE: This file (pgn-viewer.js) should primarily contain imports and top-level initialization. */
/* Avoid adding complex function definitions directly here. Use separate modules and import them. */
'use strict';

import {
  getKnownFiles,
  getActiveFile,
  DEFAULT_FILE_PATH
} from './storage/storage.js';
import { initializeDropboxSync } from './dropbox-sync.js';
import { logDevelopment } from './logging.js';
import {
  setupAddFileModalListeners,
  setupRenameFileModalListeners,
  setupDeleteFileConfirmListener
} from './storage/files.js';
import { renderBoard, flipBoard, cyclePieceSet } from './board-ui.js';
import {
  initializeGame, getCurrentFen, loadPgn, getPgnHeaders, getGameHistory,
  goToStart, goToPreviousMove, goToNextMove, goToEnd, getCurrentMoveIndex,
  goToMoveIndex // Import specific index navigation
} from './game-logic.js';

const addFileButton = $('#addFileButton');
const renameFileButton = $('#renameFileButton');
const deleteFileButton = $('#deleteFileButton');
const newFileNameInput = $('#newFileNameInput');
const currentFileNameToRename = $('#currentFileNameToRename');
const newRenameFileNameInput = $('#newRenameFileNameInput');
const flipBoardButton = $('#btn-flip-board'); // Get the flip button
const cyclePiecesButton = $('#btn-cycle-pieces'); // Get the cycle pieces button
const loadPgnButton = $('#btn-load-pgn'); // Get the load PGN button
const pgnInputArea = $('#pgn-input'); // Get the PGN textarea
const chessboardContainer = $('#chessboard'); // Get the board container
// Navigation Buttons
const startButton = $('#btn-start');
const prevButton = $('#btn-prev');
const nextButton = $('#btn-next');
const endButton = $('#btn-end');
// PGN Info Display Elements
const pgnHeaderWhite = $('#pgn-header-white');
const pgnHeaderBlack = $('#pgn-header-black');
const pgnHeaderResult = $('#pgn-header-result');
const pgnHeaderEvent = $('#pgn-header-event');
const pgnHeaderDate = $('#pgn-header-date');
const pgnMovesList = $('#pgn-moves-list'); // The <ul> element for moves

let addFileModalInstance = null;
let renameFileModalInstance = null;

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
    // Ensure i18next processes the newly added element if needed, or handle default text
    if (window.i18next && window.applyI18nToElement) {
      window.applyI18nToElement(pgnMovesList.children().last()[0]);
    }
    return;
  }

  let moveNumber = 1;
  let movePairIndex = 0; // Index for the <li> element (pair of moves)
  let fullMoveHtml = '';

  history.forEach((move, index) => {
    // Add data-move-index to each individual move span for potential click handling later
    const moveHtml = `<span class="move ${move.color === 'w' ? 'white-move' : 'black-move'}" data-move-index="${index}">${move.san}</span>`;

    if (move.color === 'w') {
      // Start of a new full move (White's move)
      if (fullMoveHtml) {
        // Append the previous full move if it exists, using movePairIndex
        pgnMovesList.append(`<li class="list-group-item p-1" data-move-pair-index="${movePairIndex}">${fullMoveHtml}</li>`);
        movePairIndex++; // Increment index for the next pair
      }
      // Start new pair with move number and white's move
      fullMoveHtml = `<span class="move-number">${moveNumber}.</span> ${moveHtml}`;
      moveNumber++;
    } else {
      // Black's move - append to the current full move string
      fullMoveHtml += ` ${moveHtml}`;
      // Append the completed pair immediately after Black's move
      pgnMovesList.append(`<li class="list-group-item p-1" data-move-pair-index="${movePairIndex}">${fullMoveHtml}</li>`);
      movePairIndex++; // Increment index for the next pair
      fullMoveHtml = ''; // Reset for the next pair
    }
  });

  // Ensure the last move pair is added if history ends on White's move
  if (fullMoveHtml) {
    pgnMovesList.append(`<li class="list-group-item p-1" data-move-pair-index="${movePairIndex}">${fullMoveHtml}</li>`);
  }

  // Initial highlight
  highlightCurrentMove();
}


/**
 * Highlights the current move in the PGN moves list based on getCurrentMoveIndex().
 */
function highlightCurrentMove() {
  const currentIdx = getCurrentMoveIndex();
  logDevelopment(`Highlighting move index: ${currentIdx}`, 'debug');

  // Remove highlight from all moves first
  pgnMovesList.find('li').removeClass('active'); // Remove from list items
  pgnMovesList.find('span.move').removeClass('active-move'); // Remove from individual move spans

  if (currentIdx === -1) {
    // Highlight the "start" state - perhaps no highlight or a specific indicator if needed
    logDevelopment("At start, no move highlighted.", 'debug');
  } else {
    // Find the specific move span to highlight
    const targetMoveSpan = pgnMovesList.find(`span.move[data-move-index="${currentIdx}"]`);
    if (targetMoveSpan.length) {
      targetMoveSpan.addClass('active-move'); // Highlight the specific move text

      // Also highlight the parent list item (the move pair)
      const parentLi = targetMoveSpan.closest('li');
      parentLi.addClass('active');

      // Scroll the highlighted item into view
      const listElement = pgnMovesList[0]; // Get the raw DOM element
      const listItemElement = parentLi[0];
      if (listElement && listItemElement) {
        // Use scrollIntoView for potentially smoother behavior
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
    // Optionally provide feedback if navigation failed (e.g., already at end)
  }
}

// --- End Helper Functions ---


// --- Generic initialization logic below ---
$(document).ready(function () {

  logDevelopment("Document ready: Initializing UI and listeners.");
  initializeDropboxSync();
  setupDeleteFileConfirmListener();

  // --- PGN Viewer Initialization ---
  if (initializeGame()) { // Initialize the game state first
    if (chessboardContainer.length) {
      logDevelopment("Rendering initial chessboard from game state.");
      renderBoard(chessboardContainer[0], getCurrentFen()); // Render board using FEN from game logic
    } else {
      logDevelopment("Error: Chessboard container element not found!", 'error');
    }
  } else {
    logDevelopment("Error: Failed to initialize game logic!", 'error');
    // Optionally display an error to the user
  }

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
  });

  // Cycle piece set button listener
  cyclePiecesButton.click(function() {
    logDevelopment("Cycle piece set button clicked.");
    cyclePieceSet();
  });

  // Load PGN from text area button listener
  loadPgnButton.click(function() {
    logDevelopment("Load PGN button clicked.");
    // --- DEBUG: Use hardcoded example PGN instead of textarea ---
    const pgnExample = [
      '[Event "Casual Game"]',
      '[Site "Berlin GER"]',
      '[Date "1852.??.??"]',
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
    //const pgnText = pgnExample; // Use the example PGN
    //logDevelopment("Using hardcoded example PGN for testing.", 'debug');
    const pgnText = pgnInputArea.val().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!pgnText && !FIXPGN) {
      showNotification("PGN input area is empty.", 'info');
      return;
    }
    // --- END DEBUG ---
    // Removed stray return and brace from commented block above
    try {
      if (loadPgn(FIXPGN ? pgnExample : pgnText)) {
        logDevelopment("PGN loaded successfully from text area.");
        renderBoard(chessboardContainer[0], getCurrentFen()); // Re-render board with new game state

        // --- Display PGN Info and Set Initial State ---
        const headers = getPgnHeaders();
        const history = getGameHistory(); // This now returns the stored history
        displayPgnHeaders(headers);
        displayPgnMoves(history); // Display moves and set up for highlighting
        updateBoardAndHighlight(getCurrentFen()); // Render initial board and highlight (start state)
        // --- End Display PGN Info ---

        showNotification("PGN loaded successfully.", 'success');
      } else {
        // loadPgn might return false for non-exception errors (e.g., empty PGN after parsing)
        // Clear PGN info display on failure
        displayPgnHeaders({});
        displayPgnMoves([]);
        logDevelopment("Failed to load PGN from text area (loadPgn returned false).", 'warn');
        // Clear PGN info display on failure? Optional.
        // displayPgnHeaders({});
        // displayPgnMoves([]);
        showNotification("Could not load game from PGN text.", 'alert');
      }
    } catch (error) {
      const errorMessage = error.message || 'Unknown error during PGN loading.';
      logDevelopment(`Error loading PGN from text area: ${errorMessage}`, 'error');
      console.error("Error loading PGN:", error);
      showNotification(`Error loading PGN: ${errorMessage}`, 'alert'); // Show specific error
    }
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
      const newFen = goToMoveIndex(parseInt(clickedIndex, 10)); // Ensure index is integer
      updateBoardAndHighlight(newFen);
    }
  });

  // --- File Management Button Click Handlers (Modal Openers) ---

  addFileButton.click(function() {
    try {
      const addModalElement = document.getElementById('addFileModal');
      if (!addModalElement) {
        console.error("Add File Modal element not found in HTML.");
        alert("Error: Add file dialog component is missing.");
        return;
      }
      if (typeof window.bootstrap === 'undefined' || !window.bootstrap.Modal) {
        console.error("Bootstrap Modal component not found.");
        alert("Error: UI library component (Modal) not loaded.");
        return;
      }

      if (!addFileModalInstance) {
        logDevelopment("Initializing Add File Modal instance and listeners for the first time.");
        addFileModalInstance = new window.bootstrap.Modal(addModalElement);
        setupAddFileModalListeners();
      } else {
        logDevelopment("Add File Modal instance already exists.");
      }

      newFileNameInput.val('');
      addFileModalInstance.show();

    } catch (e) {
      console.error("Error showing Add File modal:", e);
      alert("Error opening Add file dialog.");
    }
  });


  renameFileButton.click(async function() {
    try {
      const renameModalElement = document.getElementById('renameFileModal');
      if (!renameModalElement) {
        console.error("Rename File Modal element not found in HTML.");
        alert("Error: Rename file dialog component is missing.");
        return;
      }
      if (typeof window.bootstrap === 'undefined' || !window.bootstrap.Modal) {
        console.error("Bootstrap Modal component not found.");
        alert("Error: UI library component (Modal) not loaded.");
        return;
      }

      if (!renameFileModalInstance) {
        logDevelopment("Initializing Rename File Modal instance and listeners for the first time.");
        renameFileModalInstance = new window.bootstrap.Modal(renameModalElement);
        setupRenameFileModalListeners();
      } else {
        logDevelopment("Rename File Modal instance already exists.");
      }

      const currentFilePath = getActiveFile();
      const knownFiles = getKnownFiles();
      const currentFile = knownFiles.find(f => f.path === currentFilePath);

      if (!currentFile) {
        console.error("Cannot rename: Active file not found in known files list.");
        alert("Error: Could not find the current file details.");
        return;
      }

      if (currentFilePath === DEFAULT_FILE_PATH) {
        showNotification("Error: The default todo.txt file cannot be renamed.", 'alert');
        return;
      }

      currentFileNameToRename.text(currentFile.name);
      newRenameFileNameInput.val(currentFile.name);
      renameFileModalInstance.show();

    } catch (e) {
      console.error("Error showing Rename File modal:", e);
      alert("Error opening Rename file dialog.");
    }
  });


  deleteFileButton.click(async function() {
    const filePathToDelete = getActiveFile();
    const knownFiles = getKnownFiles();
    const fileToDelete = knownFiles.find(f => f.path === filePathToDelete);

    if (!fileToDelete) {
      console.error("Cannot delete: Active file not found in known files list.");
      showNotification("Error: Could not find the current file details.", 'alert');
      return;
    }

    if (filePathToDelete === DEFAULT_FILE_PATH) {
      showNotification("Error: The default todo.txt file cannot be deleted.", 'alert');
      return;
    }

    logDevelopment(`Requesting delete confirmation for file: ${fileToDelete.name} (${filePathToDelete})`);

    $('#fileNameToDelete').text(fileToDelete.name);
    $('#deleteFileModalConfirm').data('filePathToDelete', filePathToDelete);
    $('#deleteFileModalConfirm').data('fileNameToDelete', fileToDelete.name);

    const deleteModalEl = document.getElementById('deleteFileModalConfirm');
    if (deleteModalEl) {
      const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
      deleteModal.show();
    } else {
      console.error("Delete confirmation modal element (#deleteFileModalConfirm) not found!");
      showNotification("Error: Delete confirmation dialog component is missing.", 'alert');
    }
  });

});
