'use strict';

/**
 * Parses a PGN string containing multiple games into an array of game objects.
 * Each game object contains the full PGN text for that game and extracted tags.
 *
 * @param {string} pgnString The full PGN content.
 * @returns {Array<Object>} An array of game objects, e.g., [{ id: 0, pgn: '...', tags: { White: '...', Black: '...' }, displayName: '...' }, ...]
 */
export function parsePgn(pgnString) {
  if (!pgnString || typeof pgnString !== 'string') {
    console.error("Invalid PGN string provided for parsing.");
    return [];
  }

  // Normalize line endings and trim whitespace
  const normalizedPgn = pgnString.replace(/\r\n/g, '\n').trim();

  // Split games. A common pattern is separation by one or more blank lines,
  // with each game starting with tag pairs like [Event "..."]
  // We prepend \n\n to handle the first game consistently during split.
  const gameStrings = `\n\n${normalizedPgn}`
    .split(/\n\n+(?=\[Event\s)/) // Split on one or more blank lines followed by [Event tag
    .map(s => s.trim()) // Trim whitespace for each potential game string
    .filter(s => s.length > 0 && s.startsWith('[')); // Ensure it starts with a tag and is not empty

  // If the split results in zero games, but the input wasn't empty,
  // treat the entire input as a single game.
  if (gameStrings.length === 0 && normalizedPgn.length > 0 && normalizedPgn.startsWith('[')) {
    gameStrings.push(normalizedPgn);
  }

  const games = gameStrings.map((gamePgn, index) => {
    const tags = {};
    const tagRegex = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
    let match;
    // Extract all tags
    while ((match = tagRegex.exec(gamePgn)) !== null) {
      tags[match[1]] = match[2];
    }

    // Basic validation: Check if essential tags exist or if moves start (1.)
    if (Object.keys(tags).length === 0 && !/^\s*1\./.test(gamePgn.substring(gamePgn.lastIndexOf(']\n') + 2))) {
      // If no tags and no clear start of moves after the last tag, skip this segment.
      console.warn("Skipping segment likely not a game:", gamePgn.substring(0, 100) + "...");
      return null;
    }

    // Create a display name for the list item
    const white = tags.White || 'Unknown';
    const black = tags.Black || 'Unknown';
    const result = tags.Result || '*';
    const event = tags.Event || 'Unknown Event';
    const date = tags.Date || '????.??.??';
    const round = tags.Round ? `Round ${tags.Round}` : '';

    let displayName = `${white} vs ${black} (${result})`;
    if (event !== 'Unknown Event' || round || date !== '????.??.??') {
      let details = [event, round, date].filter(Boolean).join(', '); // Filter out empty parts
      displayName += ` - ${details}`;
    } else {
      displayName += ` - Game ${index + 1}`;
    }

    return {
      id: index, // Simple numeric ID
      pgn: gamePgn,
      tags: tags,
      displayName: displayName.trim()
    };
  }).filter(game => game !== null); // Filter out any null entries from invalid segments

  console.log(`Parsed ${games.length} games.`);
  return games;
}
