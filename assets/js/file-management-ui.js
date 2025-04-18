'use strict';

import {
  getKnownFiles,
  getActiveFile,
  DEFAULT_FILE_PATH
} from './storage/storage.js';
import {
  setupAddFileModalListeners,
  setupRenameFileModalListeners,
  setupDeleteFileConfirmListener
} from './storage/files.js';
import { logDevelopment } from './logging.js';

// --- DOM Element Selectors ---
const addFileButton = $('#addFileButton');
const renameFileButton = $('#renameFileButton');
const deleteFileButton = $('#deleteFileButton');
const newFileNameInput = $('#newFileNameInput');
const currentFileNameToRename = $('#currentFileNameToRename');
const newRenameFileNameInput = $('#newRenameFileNameInput');

// --- Modal Instances ---
let addFileModalInstance = null;
let renameFileModalInstance = null;

// --- Event Listener Setup ---

export function initializeFileManagementListeners() {
  logDevelopment("Initializing file management listeners.");

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
        logDevelopment("Initializing Add File Modal instance and listeners for the first time.");
        addFileModalInstance = new window.bootstrap.Modal(addModalElement);
        // Setup listeners specific to the add modal *content* (like the save button inside)
        setupAddFileModalListeners();
      } else {
        logDevelopment("Add File Modal instance already exists.");
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
        logDevelopment("Initializing Rename File Modal instance and listeners for the first time.");
        renameFileModalInstance = new window.bootstrap.Modal(renameModalElement);
        // Setup listeners specific to the rename modal *content*
        setupRenameFileModalListeners();
      } else {
        logDevelopment("Rename File Modal instance already exists.");
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

    logDevelopment(`Requesting delete confirmation for file: ${fileToDelete.name} (${filePathToDelete})`);

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
}
