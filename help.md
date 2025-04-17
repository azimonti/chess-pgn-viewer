# Chess PGN Viewer Help

This document explains how to use the Chess PGN Viewer Webapp.

## Loading a PGN File

1.  Click the "Load PGN" button (usually represented by a folder icon or similar).
2.  Select a `.pgn` file from your local device using the file browser that appears.
3.  The application will load the first game found in the PGN file. If the PGN contains multiple games, typically only the first one is displayed initially (behavior might vary based on implementation).

## Viewing Game Information

*   **Metadata:** Once a game is loaded, details like Player Names (White and Black), Event, Site, Date, Round, and Result are displayed above or alongside the chessboard.
*   **Moves List:** The game's moves are listed in Standard Algebraic Notation (SAN) in a scrollable area. The current move being displayed on the board is usually highlighted.

## Navigating the Game

Use the control buttons below the board or moves list:
*   **First Move:** Go to the starting position of the game.
*   **Previous Move:** Step back one move.
*   **Next Move:** Step forward one move.
*   **Last Move:** Go to the final position of the game.
*   **Clicking Moves:** You can often click directly on a move in the moves list to jump to that specific position in the game.

## Understanding the Board

*   The chessboard visually represents the position corresponding to the currently selected move.
*   Pieces are displayed according to standard chess representation.
*   The board orientation (White at the bottom or Black at the bottom) might be configurable via settings (if implemented).

## Offline Use

This application is a Progressive Web App (PWA) and utilizes a Service Worker. After loading the app once while online, it should be available for offline use, allowing you to view previously loaded or cached PGN data (specific offline capabilities depend on the implementation).

## Troubleshooting

*   **Invalid PGN:** If the selected file is not a valid PGN or is corrupted, the application might show an error or fail to load the game. Ensure your PGN file adheres to the standard format.
*   **Multiple Games:** Standard PGN files can contain multiple games. This viewer might only load the first game by default. Check if there are options to select other games within the file (if implemented).
