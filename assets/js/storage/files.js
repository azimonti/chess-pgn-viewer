'use strict';

import { getKnownFiles, getActiveFile, setActiveFile, addKnownFile, renameKnownFile, removeKnownFile, getContentFromStorage } from './storage.js?id=8bbc53';
import { logVerbose } from '../logging.js?id=8bbc53';
import { updatePgnFileDetailsUI } from '../file-management-ui.js?id=8bbc53';

// DOM Elements
const fileListSidebar = $('#fileListSidebar');
const currentFileNameHeader = $('#currentFileNameHeader');
const addFileForm = $('#addFileForm');
const newFileNameInput = $('#newFileNameInput');
const renameFileForm = $('#renameFileForm');
const newRenameFileNameInput = $('#newRenameFileNameInput');

// Modal instances
let addFileModalInstance = null;
let renameFileModalInstance = null;

// Setup listeners for the Add File modal
export function setupAddFileModalListeners() {
  logVerbose('Setting up Add File modal listeners...');
  addFileForm.off('submit.addfile').on('submit.addfile', async function(event) {
    event.preventDefault();
    const newFileName = newFileNameInput.val();

    if (!newFileName) {
      showNotification("Error: File name cannot be empty.", 'alert');
      return;
    }
    let cleanName = newFileName.trim();
    if (!cleanName) {
      showNotification("Error: File name cannot be empty.", 'alert');
      return;
    }
    // Ensure file ends with .pgn
    if (!cleanName.toLowerCase().endsWith('.pgn')) {
      cleanName += '.pgn';
      logVerbose(`Appended .pgn extension: ${cleanName}`);
    }
    const newFilePath = cleanName.startsWith('/') ? cleanName : `/${cleanName}`;
    const knownFiles = getKnownFiles();
    if (knownFiles.some(file => file.path.toLowerCase() === newFilePath.toLowerCase())) {
      showNotification(`Error: File "${cleanName}" already exists.`, 'alert');
      return;
    }

    logVerbose(`Attempting to add new file: ${newFilePath}`);
    const addModalElement = document.getElementById('addFileModal');
    if (addModalElement) {
      addFileModalInstance = bootstrap.Modal.getInstance(addModalElement);
      if (addFileModalInstance) {
        addFileModalInstance.hide();
      }
    }


    try {
      // Dynamically import Dropbox API function
      const { uploadFileToDropbox: apiUpload } = await import('../dropbox/api.js');
      // Create an empty file on Dropbox
      const emptyContent = new Blob([''], { type: 'text/plain' });
      await apiUpload(newFilePath, emptyContent);
      logVerbose(`Empty file ${newFilePath} created on Dropbox.`);

      addKnownFile(cleanName, newFilePath);
      setActiveFile(newFilePath);
      updateFileSelectionUI(); // Update sidebar first
      await loadActiveFileContentAndUpdateUI(); // Load content for the new file
      logVerbose(`File "${cleanName}" created successfully locally and on Dropbox.`);
      showNotification(`File "${cleanName}" created successfully.`, 'success');
    } catch (error) {
      console.error(`Error adding file ${newFilePath}:`, error);
      showNotification(`Failed to add file "${cleanName}". Check console for details.`, 'alert');
    }
  });
  logVerbose('Add File modal listeners attached.');
}

// Setup listeners for the Rename File modal
export function setupRenameFileModalListeners() {
  logVerbose('Setting up Rename File modal listeners...');
  renameFileForm.off('submit.renamefile').on('submit.renamefile', async function(event) {
    event.preventDefault();
    const newFileName = newRenameFileNameInput.val();
    const oldFilePath = getActiveFile();

    // Removed check preventing renaming of default file

    if (!oldFilePath) {
      showNotification("Error: No active file selected to rename.", 'alert');
      const renameModalElement = document.getElementById('renameFileModal');
      if (renameModalElement) {
        renameFileModalInstance = bootstrap.Modal.getInstance(renameModalElement);
        if (renameFileModalInstance) renameFileModalInstance.hide();
      }
      return;
    }

    if (!newFileName) {
      showNotification("Error: New file name cannot be empty.", 'alert');
      return;
    }
    let cleanNewName = newFileName.trim();
    if (!cleanNewName) {
      showNotification("Error: New file name cannot be empty.", 'alert');
      return;
    }
    // Ensure file ends with .pgn
    if (!cleanNewName.toLowerCase().endsWith('.pgn')) {
      cleanNewName += '.pgn';
      logVerbose(`Appended .pgn extension: ${cleanNewName}`);
    }
    const newFilePath = cleanNewName.startsWith('/') ? cleanNewName : `/${cleanNewName}`;
    if (newFilePath.toLowerCase() === oldFilePath.toLowerCase()) {
      logVerbose("Rename cancelled: New name is the same as the old name.");
      const renameModalElement = document.getElementById('renameFileModal');
      if (renameModalElement) {
        renameFileModalInstance = bootstrap.Modal.getInstance(renameModalElement);
        if (renameFileModalInstance) renameFileModalInstance.hide();
      }
      return;
    }
    const currentKnownFiles = getKnownFiles();
    if (currentKnownFiles.some(file => file.path.toLowerCase() === newFilePath.toLowerCase())) {
      showNotification(`Error: A file named "${cleanNewName}" already exists.`, 'alert');
      return;
    }

    logVerbose(`Attempting to rename file from "${oldFilePath}" to "${newFilePath}"`);
    const renameModalElement = document.getElementById('renameFileModal');
    if (renameModalElement) {
      renameFileModalInstance = bootstrap.Modal.getInstance(renameModalElement);
      if (renameFileModalInstance) renameFileModalInstance.hide(); // Hide modal
    }

    // Rename Logic (Local First)
    try {
      // 1. Perform local rename (includes moving data)
      logVerbose(`Attempting local rename for ${oldFilePath} to ${newFilePath}`);
      const localRenameSuccess = renameKnownFile(oldFilePath, cleanNewName, newFilePath);

      if (localRenameSuccess) {
        logVerbose(`Local rename successful. Updating UI...`);
        // 2. Update UI
        updateFileSelectionUI();
        showNotification(`File renamed to "${cleanNewName}".`, 'success');

        // 3. Attempt Dropbox rename
        try {
          const { renameDropboxFile: apiRename } = await import('../dropbox/api.js');
          logVerbose(`Attempting Dropbox rename for ${oldFilePath} to ${newFilePath}...`);
          const dropboxRenameSuccess = await apiRename(oldFilePath, newFilePath);

          if (dropboxRenameSuccess) {
            logVerbose(`Dropbox rename successful.`);
          } else {
            logVerbose(`Dropbox rename failed or was not possible.`);
            showNotification(`Note: Could not rename file on Dropbox. Local file is now "${cleanNewName}".`, 'warning');
            // Consider triggering an upload under the new name
          }
        } catch (dropboxError) {
          console.error(`Error during Dropbox rename attempt:`, dropboxError);
          logVerbose(`Dropbox rename attempt failed.`);
          showNotification(`Error trying to rename file on Dropbox. Local file is now "${cleanNewName}".`, 'warning');
        }

      } else {
        // Local rename failed
        logVerbose(`Local rename failed for "${oldFilePath}" to "${newFilePath}".`);
        showNotification(`Failed to rename file locally. Check console for details.`, 'alert');
      }

    } catch (error) {
      console.error(`Error during file rename process:`, error);
      showNotification(`Failed to complete file rename process. Check console for details.`, 'alert');
    }
  });
  logVerbose('Rename File modal listeners attached.');
}


// --- File Selection UI ---
export function updateFileSelectionUI() {
  logVerbose("Updating file selection UI...");
  const knownFiles = getKnownFiles();
  const activeFilePath = getActiveFile(); // Can be null if no files exist or none selected
  let activeFileName = "No file selected"; // Default header text

  fileListSidebar.empty();

  knownFiles.forEach(file => {
    const listItem = $('<li class="nav-item"></li>');
    const link = $('<a class="nav-link" href="#"></a>')
      .text(file.name)
      .data('path', file.path)
      .click(async function(e) { // Make this function async
        e.preventDefault();
        const selectedPath = $(this).data('path');
        if (selectedPath !== getActiveFile()) {
          logVerbose(`Switching active file to: ${selectedPath}`);
          setActiveFile(selectedPath);
          updateFileSelectionUI(); // Update sidebar highlighting first
          await loadActiveFileContentAndUpdateUI(); // Load content and update main UI
          // Optionally trigger sync for the new file
        }
      });

    // Highlight the active file
    if (file.path === activeFilePath) {
      link.addClass('active');
      activeFileName = file.name; // Update the name for the header
    }

    listItem.append(link);
    fileListSidebar.append(listItem);
  });

  // Extract the base name by removing the extension
  const lastDotIndex = activeFileName.lastIndexOf('.');
  const displayName = lastDotIndex === -1 ? activeFileName : activeFileName.substring(0, lastDotIndex);

  // Update the main header text
  currentFileNameHeader.text(displayName);
  logVerbose(`Active file header text set to: ${displayName}`);
}


/**
 * Loads the content of the currently active file from storage,
 * updates the main PGN text area, and refreshes the game details UI.
 */
export async function loadActiveFileContentAndUpdateUI() {
  const activeFilePath = getActiveFile(); // Can be null
  const knownFiles = getKnownFiles();
  const activeFile = activeFilePath ? knownFiles.find(f => f.path === activeFilePath) : null;
  const activeFileName = activeFile ? activeFile.name : "No file selected";

  logVerbose(`Loading content for active file: ${activeFileName} (${activeFilePath || 'None'})`);

  // If there's no active file path, clear the UI and don't try to load content
  if (!activeFilePath || !activeFile) {
    logVerbose(`No active file found. Clearing PGN details UI.`);
    updatePgnFileDetailsUI(activeFileName, '', true); // Clear game list and PGN input
    // Optionally clear game logic state here if needed
    return;
  }

  try {
    const content = await getContentFromStorage(); // Gets content for the active file (which we know exists here)
    if (content !== null) {
      updatePgnFileDetailsUI(activeFileName, content, false); // Update the game list below text area
      logVerbose(`Successfully loaded content for ${activeFileName} and updated UI.`);

      // Also trigger game logic load (important!)
      // Dynamically import to avoid circular dependencies if needed, or ensure loadPgn is globally accessible/imported elsewhere
      const { loadPgn } = await import('../game-logic.js');
      if (loadPgn(content)) {
        logVerbose(`Game logic loaded successfully for ${activeFileName}.`);
      } else {
        logVerbose(`Could not load game logic for ${activeFileName}. Content might be invalid PGN.`);
      }

    } else {
      logVerbose(`No content found in storage for ${activeFileName}. Clearing UI.`);
      updatePgnFileDetailsUI(activeFileName, '', false); // Clear game list
    }
  } catch (error) {
    console.error(`Error loading content for ${activeFileName}:`, error);
    showNotification(`Error loading content for ${activeFileName}. Check console.`, 'alert');
    updatePgnFileDetailsUI(activeFileName, '', false);
  }
}


// Setup listener for the delete file confirmation modal button
export function setupDeleteFileConfirmListener() {
  $('#confirmDeleteFileButton').off('click.deleteconfirm').on('click.deleteconfirm', async function() {
    const modalElement = $('#deleteFileModalConfirm');
    const filePathToDelete = modalElement.data('filePathToDelete');
    const fileNameToDelete = modalElement.data('fileNameToDelete');

    // Hide the modal
    const deleteModalInstance = bootstrap.Modal.getInstance(modalElement[0]);
    if (deleteModalInstance) {
      deleteModalInstance.hide();
    }

    if (!filePathToDelete || !fileNameToDelete) {
      console.error("Could not retrieve file path or name from modal data for deletion confirmation.");
      showNotification("Error confirming deletion. Missing file details. Please try again.", 'alert');
      modalElement.removeData('filePathToDelete').removeData('fileNameToDelete');
      return;
    }

    logVerbose(`Confirmed deletion for file: ${fileNameToDelete} (${filePathToDelete})`);

    // Deletion Logic (Local First)
    let dropboxDeleteAttempted = false;
    let dropboxDeleteSuccess = false;

    try {
      // 1. Attempt Dropbox delete (non-blocking)
      try {
        const { deleteDropboxFile: apiDelete } = await import('../dropbox/api.js');
        logVerbose(`Attempting Dropbox deletion for ${filePathToDelete}...`);
        dropboxDeleteAttempted = true;
        dropboxDeleteSuccess = await apiDelete(filePathToDelete);
        if (dropboxDeleteSuccess) {
          logVerbose(`Dropbox deletion successful for ${filePathToDelete}.`);
        } else {
          logVerbose(`Dropbox deletion failed or was not possible for ${filePathToDelete}. Proceeding with local deletion.`);
        }
      } catch (dropboxError) {
        console.error(`Error during Dropbox delete attempt for ${filePathToDelete}:`, dropboxError);
        logVerbose(`Dropbox delete attempt failed for ${filePathToDelete}. Proceeding with local deletion.`);
      }

      // 2. Remove from local storage
      logVerbose(`Proceeding with local removal for ${filePathToDelete}`);
      removeKnownFile(filePathToDelete); // Handles switching active file if needed

      // 3. Update UI (sidebar first)
      updateFileSelectionUI();
      // 4. Load content of the *new* active file (likely the default)
      await loadActiveFileContentAndUpdateUI();

      // 5. Show notification
      showNotification(`File "${fileNameToDelete}" removed locally.`, 'success');
      if (dropboxDeleteAttempted && !dropboxDeleteSuccess) {
        showNotification(`Note: Could not remove "${fileNameToDelete}" from Dropbox.`, 'warning');
      }

    } catch (error) {
      console.error(`Error during local deletion or UI update for ${filePathToDelete}:`, error);
      showNotification(`Failed to fully remove file "${fileNameToDelete}" locally. Check console for details.`, 'alert');
    } finally {
      // Clear data from modal
      modalElement.removeData('filePathToDelete').removeData('fileNameToDelete');
    }
  });
  logVerbose('Delete file confirmation listener attached.');
}
