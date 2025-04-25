/* NOTE: This file (pgn-viewer.js) should primarily contain imports and top-level initialization.
/* Avoid adding complex function definitions directly here. Use separate modules and import them.
/* example of localized notification
/* showNotification(i18next.t('notification.disappearingAlert', 'Disappearing alert notification'), 'alert', i18next.t('notification.disappearingAlertTitle', 'Alert')); */
'use strict';

import { initializeDropboxSync } from './dropbox-sync.js?id=8bbc53';
import { renderBoard } from './board-ui.js';
import { initializeGame, getCurrentFen } from './game-logic.js?id=8bbc53';
import { initializePgnDisplayListeners } from './pgn-display.js?id=8bbc53';
import { initializeFileManagementListeners } from './file-management-ui.js?id=8bbc53';
import { updateFileSelectionUI, loadActiveFileContentAndUpdateUI } from './storage/files.js?id=8bbc53';

// --- DOM Element Selectors (Minimal) ---
const chessboardContainer = $('#chessboard'); // Keep for initial render

// --- Generic initialization logic below ---
$(document).ready(function () {

  initializeDropboxSync(); // Initialize Dropbox sync early

  // --- PGN Viewer Core Initialization ---
  if (initializeGame()) { // Initialize the game state first
    if (chessboardContainer.length) {
      renderBoard(chessboardContainer[0], getCurrentFen()); // Render initial board
    } else {
      console.warn("Error: Chessboard container element not found!", 'error');
    }
  } else {
    console.error("Error: Failed to initialize game logic!", 'error');
  }

  // --- Initialize Feature Modules ---
  initializePgnDisplayListeners(); // Setup listeners for PGN display, controls, navigation
  initializeFileManagementListeners(); // Setup listeners for file add/rename/delete buttons and modals

  // --- Initial File UI Population and Content Load ---
  updateFileSelectionUI(); // Populate the file list sidebar
  loadActiveFileContentAndUpdateUI(); // Load content of the initially active file

});
