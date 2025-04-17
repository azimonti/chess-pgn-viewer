/* global showNotification */
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
 import { initializeGame, getCurrentFen, loadPgn } from './game-logic.js'; // Import game logic functions

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

let addFileModalInstance = null;
let renameFileModalInstance = null;


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
    const pgnText = pgnInputArea.val();
    if (!pgnText) {
      showNotification("PGN input area is empty.", 'info');
      return;
    }
    try {
      if (loadPgn(pgnText)) {
        logDevelopment("PGN loaded successfully from text area.");
        renderBoard(chessboardContainer[0], getCurrentFen()); // Re-render board with new game state
        showNotification("PGN loaded successfully.", 'success');
      } else {
        // loadPgn might return false for non-exception errors (e.g., empty PGN after parsing)
        logDevelopment("Failed to load PGN from text area (loadPgn returned false).", 'warn');
        showNotification("Could not load game from PGN text.", 'alert');
      }
     } catch (error) {
       const errorMessage = error.message || 'Unknown error during PGN loading.';
       logDevelopment(`Error loading PGN from text area: ${errorMessage}`, 'error');
       console.error("Error loading PGN:", error);
       showNotification(`Error loading PGN: ${errorMessage}`, 'alert'); // Show specific error
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
