'use strict';

import {
  makeMove,
  getCurrentFen,
  getPieceAt,
  getValidMoves,
  getTurn
} from './game-logic.js';

// --- Constants ---
const PIECE_SETS = ['set1', 'set2', 'set3'];
const pieceMap = { // Map FEN characters to filenames
  'r': 'rook_black.png', 'n': 'knight_black.png', 'b': 'bishop_black.png', 'q': 'queen_black.png', 'k': 'king_black.png', 'p': 'pawn_black.png',
  'R': 'rook_white.png', 'N': 'knight_white.png', 'B': 'bishop_white.png', 'Q': 'queen_white.png', 'K': 'king_white.png', 'P': 'pawn_white.png'
};
const CSS_CLASSES = {
  SQUARE: 'square',
  LIGHT: 'light',
  DARK: 'dark',
  SELECTED: 'selected', // For the selected piece's square
  VALID_MOVE: 'valid-move', // For squares the selected piece can move to
  CHESS_PIECE: 'chess-piece',
  BOARD_GRID: 'board-grid',
  INDICES: 'indices',
  RANK: 'rank',
  FILE: 'file'
};

// --- State Variables ---
let currentPieceSetIndex = 0;
let isBoardFlipped = false;
let selectedSquareEl = null; // The DOM element of the selected square
let selectedSquareAlgebraic = null; // e.g., 'e4'
let validMoveSquares = []; // Array of algebraic notations for valid moves

// --- Helper Functions ---

function getCurrentPieceImagePath() {
  return `img/${PIECE_SETS[currentPieceSetIndex]}/`;
}

/**
 * Converts rank/file indices to algebraic notation (e.g., 0,0 -> a8).
 * Considers board flip state.
 * @param {number} rankIndex - 0-based index from the top row.
 * @param {number} fileIndex - 0-based index from the left file.
 * @returns {string} Algebraic notation (e.g., 'a1', 'h8').
 */
function indicesToAlgebraic(rankIndex, fileIndex) {
  const file = isBoardFlipped
    ? String.fromCharCode('h'.charCodeAt(0) - fileIndex)
    : String.fromCharCode('a'.charCodeAt(0) + fileIndex);
  const rank = isBoardFlipped
    ? (rankIndex + 1).toString()
    : (8 - rankIndex).toString();
  return file + rank;
}

/**
 * Clears any visual selection highlights (selected square, valid moves).
 */
function clearHighlights() {
  if (selectedSquareEl) {
    selectedSquareEl.classList.remove(CSS_CLASSES.SELECTED);
  }
  document.querySelectorAll(`.${CSS_CLASSES.VALID_MOVE}`).forEach(el => {
    el.classList.remove(CSS_CLASSES.VALID_MOVE);
  });
  selectedSquareEl = null;
  selectedSquareAlgebraic = null;
  validMoveSquares = [];
}

/**
 * Highlights the selected square and its valid move destinations.
 * @param {HTMLElement} squareEl - The DOM element of the square to select.
 * @param {string} algebraic - The algebraic notation of the square.
 */
function highlightSelection(squareEl, algebraic) {
  clearHighlights(); // Clear previous selection first

  selectedSquareEl = squareEl;
  selectedSquareAlgebraic = algebraic;
  selectedSquareEl.classList.add(CSS_CLASSES.SELECTED);

  validMoveSquares = getValidMoves(algebraic);

  validMoveSquares.forEach(moveAlgebraic => {
    const moveSquareEl = document.querySelector(`[data-square="${moveAlgebraic}"]`);
    if (moveSquareEl) {
      moveSquareEl.classList.add(CSS_CLASSES.VALID_MOVE);
    }
  });
}

// --- Event Handlers ---

/**
 * Handles clicking on a square.
 * @param {Event} event - The click event.
 */
function handleSquareClick(event) {
  const clickedSquareEl = event.currentTarget;
  const clickedAlgebraic = clickedSquareEl.dataset.square;

  if (!clickedAlgebraic) {
    console.warn('Clicked element has no square data attribute.');
    return;
  }

  const piece = getPieceAt(clickedAlgebraic);
  const turn = getTurn(); // 'w' or 'b'
  const playerColor = isBoardFlipped ? 'b' : 'w'; // Color at the bottom

  // --- Move Attempt ---
  if (selectedSquareAlgebraic) {
    if (selectedSquareAlgebraic === clickedAlgebraic) {
      // Clicked the same square again - deselect
      clearHighlights();
      return;
    }

    // Check if the clicked square is a valid move destination
    if (validMoveSquares.includes(clickedAlgebraic)) {
      const moveResult = makeMove(selectedSquareAlgebraic, clickedAlgebraic);
      clearHighlights(); // Clear highlights regardless of move success
      if (moveResult) {
        // Successful move - re-render the board
        renderBoard(document.getElementById('chessboard'), getCurrentFen());
        // Check for game over state? (optional here)
      } else {
        // Invalid move according to chess.js (shouldn't happen if UI checks are correct)
        console.warn('Move invalid by chess.js despite UI check.');
      }
      return; // Move attempted, finish handling
    }
  }

  // --- Piece Selection ---
  clearHighlights(); // Clear any previous selection if move wasn't made
  if (piece && piece.color === turn) {
    highlightSelection(clickedSquareEl, clickedAlgebraic);
  } else {
    // Optionally log or provide feedback if selection is invalid
  }
}


// --- Core Functions ---

/**
 * Cycles to the next piece set and re-renders the board.
 */
export function cyclePieceSet() {
  currentPieceSetIndex = (currentPieceSetIndex + 1) % PIECE_SETS.length;
  renderBoard(document.getElementById('chessboard'), getCurrentFen()); // Re-render with current FEN
}

/**
 * Gets the current board orientation state.
 * @returns {boolean} True if the board is flipped (Black at bottom), false otherwise.
 */
export function getIsBoardFlipped() {
  return isBoardFlipped;
}

/**
 * Toggles the board orientation.
 */
export function flipBoard() {
  isBoardFlipped = !isBoardFlipped;
  clearHighlights(); // Clear selection when flipping
  renderBoard(document.getElementById('chessboard'), getCurrentFen()); // Re-render with current FEN
}

/**
 * Renders the chessboard with pieces based on a FEN string.
 * @param {HTMLElement} boardContainer - The container element for the chessboard.
 * @param {string} fen - The FEN string representing the position to render.
 */
export function renderBoard(boardContainer, fen) {
  if (!boardContainer) {
    console.error('Error: Chessboard container not found!');
    return;
  }
  if (!fen) {
    console.error('Error: No FEN provided for rendering!');
    return;
  }

  boardContainer.innerHTML = ''; // Clear previous board

  // --- Create Indices ---
  const rankIndices = document.createElement('div');
  rankIndices.className = `${CSS_CLASSES.INDICES} ${CSS_CLASSES.RANK}`;
  const fileIndices = document.createElement('div');
  fileIndices.className = `${CSS_CLASSES.INDICES} ${CSS_CLASSES.FILE}`;

  const ranks = isBoardFlipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
  const files = isBoardFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  ranks.forEach(r => {
    const span = document.createElement('span'); span.textContent = r; rankIndices.appendChild(span);
  });
  files.forEach(f => {
    const span = document.createElement('span'); span.textContent = f; fileIndices.appendChild(span);
  });

  boardContainer.appendChild(rankIndices);
  boardContainer.appendChild(fileIndices);

  // --- Create Board Grid ---
  const boardGrid = document.createElement('div');
  boardGrid.className = CSS_CLASSES.BOARD_GRID;

  // Use chess.js logic (via game-logic) to parse FEN piece placement
  const fenParts = fen.split(' ');
  const piecePlacement = fenParts[0];
  const fenRanks = piecePlacement.split('/');

  const rankIteration = isBoardFlipped ? fenRanks.slice().reverse() : fenRanks;

  rankIteration.forEach((fenRank, rankIndex) => {
    let currentFileIndex = 0;
    const fileIteration = isBoardFlipped ? fenRank.split('').slice().reverse() : fenRank.split('');

    fileIteration.forEach(char => {
      if (isNaN(parseInt(char, 10))) { // It's a piece
        const algebraic = indicesToAlgebraic(rankIndex, currentFileIndex);
        const square = createSquareElement(rankIndex, currentFileIndex, algebraic);
        const pieceData = pieceMap[char]; // Get filename from map
        if (pieceData) {
          const pieceImage = document.createElement('img');
          pieceImage.src = `${getCurrentPieceImagePath()}${pieceData}`;
          pieceImage.alt = char;
          pieceImage.classList.add(CSS_CLASSES.CHESS_PIECE);
          square.appendChild(pieceImage);
        } else {
          console.warn(`Warning: No image mapping found for FEN character: ${char}`);
        }
        boardGrid.appendChild(square);
        currentFileIndex++;
      } else { // It's a number (empty squares)
        const emptySquares = parseInt(char, 10);
        for (let i = 0; i < emptySquares; i++) {
          const algebraic = indicesToAlgebraic(rankIndex, currentFileIndex);
          const square = createSquareElement(rankIndex, currentFileIndex, algebraic);
          boardGrid.appendChild(square);
          currentFileIndex++;
        }
      }
    });
  });

  boardContainer.appendChild(boardGrid);
}

/**
 * Helper function to create a single square DOM element with event listener.
 * @param {number} rankIndex - 0-based index (visual top-to-bottom).
 * @param {number} fileIndex - 0-based index (visual left-to-right).
 * @param {string} algebraic - Algebraic notation (e.g., 'e4').
 * @returns {HTMLElement} The created square element.
 */
function createSquareElement(rankIndex, fileIndex, algebraic) {
  const square = document.createElement('div');
  // Determine color based on *algebraic* coordinates, not visual indices
  const fileCharCode = algebraic.charCodeAt(0);
  const rankCharCode = algebraic.charCodeAt(1);
  const isLight = (fileCharCode + rankCharCode) % 2 !== 0; // a1 is dark

  square.classList.add(CSS_CLASSES.SQUARE, isLight ? CSS_CLASSES.LIGHT : CSS_CLASSES.DARK);
  square.dataset.square = algebraic; // Store algebraic notation
  square.addEventListener('click', handleSquareClick);
  return square;
}

// Initialization is handled in pgn-viewer.js
