'use strict';

import { getKnownFiles, getActiveFile, DEFAULT_FILE_PATH, saveContentToStorage, setActiveFile, addKnownFile } from './storage/storage.js';
import { parsePgn } from './pgn-parser.js';
import { loadPgn, getPgnHeaders, getGameHistory, getCurrentFen } from './game-logic.js';
import { displayPgnHeaders, displayPgnMoves, updateBoardAndHighlight } from './pgn-display.js';
import { setupAddFileModalListeners, setupRenameFileModalListeners, setupDeleteFileConfirmListener, updateFileSelectionUI } from './storage/files.js';

// --- DOM Element Selectors ---
const addFileButton = $('#addFileButton');
const renameFileButton = $('#renameFileButton');
const deleteFileButton = $('#deleteFileButton');
const newFileNameInput = $('#newFileNameInput');
const currentFileNameToRename = $('#currentFileNameToRename');
const newRenameFileNameInput = $('#newRenameFileNameInput');
const pgnInputElement = $('#pgn-input');
const importFileDiskInput = $('#importFileDiskInput');

// --- Modal Instances ---
let addFileModalInstance = null;
let renameFileModalInstance = null;

// --- Event Listener Setup ---

export function initializeFileManagementListeners() {
  // Setup the listener for the delete confirmation button *once*
  // This assumes setupDeleteFileConfirmListener handles attaching the actual delete logic
  setupDeleteFileConfirmListener();

  addFileButton.click(function() {
    try {
      const addModalElement = document.getElementById('addFileModal');
      if (!addModalElement) {
        console.error("Add File Modal element not found in HTML.");
        alert("Error: Add file dialog component is missing."); // Keep alert for critical UI failure
        return;
      }
      if (typeof window.bootstrap === 'undefined' || !window.bootstrap.Modal) {
        console.error("Bootstrap Modal component not found.");
        alert("Error: UI library component (Modal) not loaded."); // Keep alert for critical UI failure
        return;
      }

      if (!addFileModalInstance) {
        addFileModalInstance = new window.bootstrap.Modal(addModalElement);
        // Setup listeners specific to the add modal *content* (like the save button inside)
        setupAddFileModalListeners();
      } else {
        console.warn("Add File Modal instance already exists.");
      }

      newFileNameInput.val(''); // Clear input before showing
      addFileModalInstance.show();

    } catch (e) {
      console.error("Error showing Add File modal:", e);
      alert("Error opening Add file dialog."); // Keep alert for critical UI failure
    }
  });


  renameFileButton.click(async function() {
    try {
      const renameModalElement = document.getElementById('renameFileModal');
      if (!renameModalElement) {
        console.error("Rename File Modal element not found in HTML.");
        alert("Error: Rename file dialog component is missing."); // Keep alert for critical UI failure
        return;
      }
      if (typeof window.bootstrap === 'undefined' || !window.bootstrap.Modal) {
        console.error("Bootstrap Modal component not found.");
        alert("Error: UI library component (Modal) not loaded."); // Keep alert for critical UI failure
        return;
      }

      if (!renameFileModalInstance) {
        renameFileModalInstance = new window.bootstrap.Modal(renameModalElement);
        // Setup listeners specific to the rename modal *content*
        setupRenameFileModalListeners();
      } else {
        console.warn("Rename File Modal instance already exists.");
      }

      const currentFilePath = getActiveFile();
      const knownFiles = getKnownFiles();
      const currentFile = knownFiles.find(f => f.path === currentFilePath);

      if (!currentFile) {
        console.error("Cannot rename: Active file not found in known files list.");
        // Use showNotification if available and preferred
        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.findFileError', 'Error: Could not find the current file details.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
        } else {
          alert("Error: Could not find the current file details.");
        }
        return;
      }

      if (currentFilePath === DEFAULT_FILE_PATH) {
        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.renameDefaultError', 'Error: The default file cannot be renamed.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
        } else {
          alert("Error: The default file cannot be renamed.");
        }
        return;
      }

      currentFileNameToRename.text(currentFile.name); // Set display name
      newRenameFileNameInput.val(currentFile.name); // Set input value
      renameFileModalInstance.show();

    } catch (e) {
      console.error("Error showing Rename File modal:", e);
      alert("Error opening Rename file dialog."); // Keep alert for critical UI failure
    }
  });


  deleteFileButton.click(async function() {
    const filePathToDelete = getActiveFile();
    const knownFiles = getKnownFiles();
    const fileToDelete = knownFiles.find(f => f.path === filePathToDelete);

    if (!fileToDelete) {
      console.error("Cannot delete: Active file not found in known files list.");
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.findFileError', 'Error: Could not find the current file details.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      } else {
        alert("Error: Could not find the current file details.");
      }
      return;
    }

    if (filePathToDelete === DEFAULT_FILE_PATH) {
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.deleteDefaultError', 'Error: The default file cannot be deleted.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      } else {
        alert("Error: The default file cannot be deleted.");
      }
      return;
    }

    // Populate the confirmation modal before showing
    $('#fileNameToDelete').text(fileToDelete.name);
    // Store data needed by the confirmation button's listener (setup by setupDeleteFileConfirmListener)
    $('#deleteFileModalConfirm').data('filePathToDelete', filePathToDelete);
    $('#deleteFileModalConfirm').data('fileNameToDelete', fileToDelete.name);

    const deleteModalEl = document.getElementById('deleteFileModalConfirm');
    if (deleteModalEl && window.bootstrap && window.bootstrap.Modal) {
      // Use getOrCreateInstance to avoid issues if it was already initialized elsewhere
      const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
      deleteModal.show();
    } else {
      console.error("Delete confirmation modal element (#deleteFileModalConfirm) or Bootstrap not found!");
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.deleteModalMissingError', 'Error: Delete confirmation dialog component is missing.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      } else {
        alert("Error: Delete confirmation dialog component is missing.");
      }
    }
  });

  // --- File Import Listener ---
  importFileDiskInput.on('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
      console.log("No file selected.");
      return;
    }

    // Basic validation (optional, but good practice)
    if (!file.name.toLowerCase().endsWith('.pgn')) {
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.invalidFileType', 'Invalid file type. Please select a .pgn file.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      } else {
        alert("Invalid file type. Please select a .pgn file.");
      }
      // Clear the input value to allow selecting the same file again if needed
      $(this).val('');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const pgnContent = e.target.result;
      const fileName = file.name;

      // Load the PGN into the game logic/board
      try {
        if (loadPgn(pgnContent)) {
          // Successfully loaded into game logic, pgn-display.js handles board/header updates
          if (window.showNotification && window.i18next) {
            showNotification(i18next.t('notification.pgnImportSuccess', 'PGN "{{fileName}}" imported successfully.', { fileName }), 'success', i18next.t('notification.titleSuccess', 'Success'));
          }
        } else {
          // loadPgn returned false (likely invalid PGN format for chess.js)
          if (window.showNotification && window.i18next) {
            showNotification(i18next.t('notification.pgnImportLoadError', 'Could not load game from imported PGN "{{fileName}}".', { fileName }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
          }
        }
      } catch (error) {
        const errorMessage = error.message || (window.i18next ? i18next.t('notification.pgnLoadUnknownError', 'Unknown error during PGN loading.') : 'Unknown error during PGN loading.');
        console.error(`Error loading imported PGN: ${errorMessage}`, error);
        if (window.showNotification && window.i18next) {
          showNotification(i18next.t('notification.pgnImportErrorDetail', 'Error loading imported PGN "{{fileName}}": {{error}}', { fileName, error: errorMessage }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
        }
      }

      // 3. Update the file details UI (filename and game list)
      updatePgnFileDetailsUI(fileName, pgnContent);

      // 4. Save the imported file to storage if it doesn't exist
      const knownFiles = getKnownFiles();
      const filePath = `/${fileName}`; // Simple path generation
      const fileExists = knownFiles.some(f => f.path.toLowerCase() === filePath.toLowerCase());

      if (!fileExists) {
        try {
          addKnownFile(fileName, filePath); // Add to known files list
          setActiveFile(filePath); // Set as active file
          saveContentToStorage(pgnContent); // Save content *after* setting active
          updateFileSelectionUI(); // Update sidebar
          console.log(`Imported file "${fileName}" saved as ${filePath} and set as active.`);
          if (window.showNotification && window.i18next) {
            showNotification(i18next.t('notification.pgnImportSaved', 'Imported file "{{fileName}}" saved.', { fileName }), 'info', i18next.t('notification.titleInfo', 'Info'));
          }
        } catch (saveError) {
          console.error(`Error saving imported file "${fileName}":`, saveError);
          if (window.showNotification && window.i18next) {
            showNotification(i18next.t('notification.pgnImportSaveError', 'Could not save imported file "{{fileName}}".', { fileName }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
          }
        }
      } else {
        // File already exists, just set it active if it's not already
        if (getActiveFile() !== filePath) {
          setActiveFile(filePath);
          updateFileSelectionUI(); // Update sidebar highlighting
          console.log(`Imported file "${fileName}" already exists. Set as active file.`);
          if (window.showNotification && window.i18next) {
            showNotification(i18next.t('notification.pgnImportExists', 'File "{{fileName}}" already exists. Loaded content.', { fileName }), 'info', i18next.t('notification.titleInfo', 'Info'));
          }
        } else {
          console.log(`Imported file "${fileName}" already exists and is already active.`);
        }
        // Optionally: Ask user if they want to overwrite? For now, just load.
      }

      // Clear the input value after processing to allow re-importing the same file
      $(event.target).val('');

    };

    reader.onerror = function(e) {
      console.error("Error reading file:", e);
      if (window.showNotification && window.i18next) {
        showNotification(i18next.t('notification.fileReadError', 'Error reading file: {{error}}', { error: e.target.error }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
      } else {
        alert("Error reading file.");
      }
      // Clear the input value on error
      $(event.target).val('');
    };

    reader.readAsText(file); // Read the file as text
  });
}


/**
 * Updates the UI section below the PGN input to display the filename
 * and a list of games found within the PGN content.
 *
 * @param {string} fileName The name of the loaded file.
 * @param {string} pgnContent The PGN content of the file.
 */
export function updatePgnFileDetailsUI(fileName, pgnContent) {
  let detailsContainer = $('#pgn-file-details');

  // Create container if it doesn't exist
  if (detailsContainer.length === 0) {
    detailsContainer = $('<div id="pgn-file-details" class="mt-3"></div>');
    pgnInputElement.after(detailsContainer); // Insert after the pgn-input textarea
  }

  // Clear previous content
  detailsContainer.empty();

  if (!fileName || !pgnContent) {
    // If no file/content, hide or clear the container
    detailsContainer.hide();
    return;
  }

  detailsContainer.show();

  // Display filename
  detailsContainer.append(`<h6><span id="loaded-file-name" data-i18n="pgnViewer.textAreaLoading">${fileName}</span></h6>`);

  // Parse PGN and display games
  const games = parsePgn(pgnContent);

  if (games.length > 0) {
    const gameList = $('<ul id="pgn-game-list" class="list-group mt-2"></ul>');
    detailsContainer.append(gameList);

    games.forEach(game => {
      const listItem = $('<li></li>')
        .addClass('list-group-item list-group-item-action') // Action class for clickable cursor
        .css({
          'cursor': 'pointer', // Make it look clickable
          'background-color': '#F8F8F2',
          'border-bottom-color': '#999',
          'color': '#2C2C2C',
          'padding': '0.5rem 0.75rem' // Adjust padding
        })
        .text(game.displayName) // Show the generated display name
        .data('pgn', game.pgn) // Store the full PGN for this game
        .on('click', function() {
          const selectedPgn = $(this).data('pgn');
          // Load the selected game into the viewer AND update display
          try {
            if (loadPgn(selectedPgn)) {
              // Get data needed for display updates
              const headers = getPgnHeaders();
              const history = getGameHistory();
              const currentFen = getCurrentFen();

              // Call display functions from pgn-display.js
              displayPgnHeaders(headers);
              displayPgnMoves(history);
              updateBoardAndHighlight(currentFen);

              // Reset others
              gameList.find('li').css('background-color', '#F8F8F2');
              // Highlight selected
              gameList.find('li').css('color', '#2C2C2C');
              $(this).css('background-color', '#DBDBBD');
              $(this).css('color', '#0083B3');
            } else {
              console.warn("Failed to load selected game from list into game logic.");
              // Optionally show a notification
              if (window.showNotification && window.i18next) {
                showNotification(i18next.t('notification.loadGameFromListError', 'Could not load selected game.'), 'alert', i18next.t('notification.titleAlert', 'Alert'));
              }
            }
          } catch (error) {
            console.error("Error loading game from list:", error);
            if (window.showNotification && window.i18next) {
              showNotification(i18next.t('notification.loadGameFromListErrorDetail', 'Error loading selected game: {{error}}', { error: error.message }), 'alert', i18next.t('notification.titleAlert', 'Alert'));
            }
          }
          $(this).css('background-color', '#DBDBBD');
        });
      gameList.append(listItem);
    });
  } else {
    detailsContainer.append('<p class="text-muted mt-2">No games found in this PGN.</p>');
  }
}
