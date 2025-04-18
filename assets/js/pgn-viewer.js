/* NOTE: This file (pgn-viewer.js) should primarily contain imports and top-level initialization.
/* Avoid adding complex function definitions directly here. Use separate modules and import them.
/* example of localized notification
/* showNotification(i18next.t('notification.disappearingAlert', 'Disappearing alert notification'), 'alert', i18next.t('notification.disappearingAlertTitle', 'Alert')); */
'use strict';

// Core/Utility Imports
import { initializeDropboxSync } from './dropbox-sync.js';
import { logDevelopment } from './logging.js';
import { renderBoard } from './board-ui.js'; // Keep for initial render
import { initializeGame, getCurrentFen } from './game-logic.js'; // Keep for initial setup

// Feature Module Imports
import { initializePgnDisplayListeners } from './pgn-display.js';
import { initializeFileManagementListeners } from './file-management-ui.js';

// --- DOM Element Selectors (Minimal) ---
const chessboardContainer = $('#chessboard'); // Keep for initial render

// --- Generic initialization logic below ---
$(document).ready(function () {

  logDevelopment("Document ready: Initializing core components.");
  initializeDropboxSync(); // Initialize Dropbox sync early

  // --- PGN Viewer Core Initialization ---
  if (initializeGame()) { // Initialize the game state first
    if (chessboardContainer.length) {
      logDevelopment("Rendering initial chessboard from game state.");
      renderBoard(chessboardContainer[0], getCurrentFen()); // Render initial board
    } else {
      logDevelopment("Error: Chessboard container element not found!", 'error');
    }
  } else {
    logDevelopment("Error: Failed to initialize game logic!", 'error');
    // Optionally display an error to the user
  }

  // --- Initialize Feature Modules ---
  logDevelopment("Initializing feature module listeners.");
  initializePgnDisplayListeners(); // Setup listeners for PGN display, controls, navigation
  initializeFileManagementListeners(); // Setup listeners for file add/rename/delete buttons and modals

});
