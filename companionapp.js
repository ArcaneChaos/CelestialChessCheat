import React, { useState, useEffect } from 'react';
import { RefreshCw, BrainCircuit, Swords, ShieldAlert, Cpu, Lightbulb, Zap, Bot, User } from 'lucide-react';

// --- Constants ---
const MODE_MENU = 'MENU';
const MODE_COMPANION = 'COMPANION';
const MODE_TRAINING = 'TRAINING';

const PLAYER_ME = 'ME';
const PLAYER_ENEMY = 'ENEMY';
const RESULT_DRAW = 'DRAW';

const SIZES = {
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 3,
};

const INITIAL_INVENTORY = {
  [SIZES.LARGE]: 2,
  [SIZES.MEDIUM]: 3,
  [SIZES.SMALL]: 3,
};

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export default function App() {
  // --- State ---
  const [appMode, setAppMode] = useState(MODE_MENU);
  const [gameStarted, setGameStarted] = useState(false);
  const [board, setBoard] = useState(Array(9).fill(null).map(() => []));
  const [myInv, setMyInv] = useState({ ...INITIAL_INVENTORY });
  const [enemyInv, setEnemyInv] = useState({ ...INITIAL_INVENTORY });
  
  const [currentTurn, setCurrentTurn] = useState(PLAYER_ENEMY); 
  const [selectedPiece, setSelectedPiece] = useState(null); 
  
  const [suggestion, setSuggestion] = useState(null);
  const [winner, setWinner] = useState(null); 
  const [isThinking, setIsThinking] = useState(false);
  
  // Companion Settings
  const [autoSuggest, setAutoSuggest] = useState(true);

  // --- Logic Helpers ---

  const getTopPiece = (stack) => {
    if (!stack || stack.length === 0) return null;
    return stack[stack.length - 1];
  };

  const isBoardEmpty = (currentBoard) => {
      return currentBoard.every(stack => stack.length === 0);
  };

  const checkWinCondition = (currentBoard) => {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      const pA = getTopPiece(currentBoard[a]);
      const pB = getTopPiece(currentBoard[b]);
      const pC = getTopPiece(currentBoard[c]);

      if (pA && pB && pC && pA.player === pB.player && pA.player === pC.player) {
        return pA.player;
      }
    }
    return null;
  };

  const isValidMove = (currentBoard, index, size, player, inventory) => {
    if (inventory[size] <= 0) return false;
    const targetStack = currentBoard[index];
    const topPiece = getTopPiece(targetStack);
    if (!topPiece) return true;
    return size > topPiece.size;
  };

  const simulateMove = (currentBoard, move, player) => {
    const newBoard = [...currentBoard];
    newBoard[move.index] = [...newBoard[move.index], { player, size: move.size }];
    return newBoard;
  };

  // --- AI Engine (Minimax) ---

  const evaluateBoardState = (currentBoard, player) => {
    const win = checkWinCondition(currentBoard);
    if (win === PLAYER_ME) return 10000;
    if (win === PLAYER_ENEMY) return -10000;

    let score = 0;

    // 1. Center Control
    const centerPiece = getTopPiece(currentBoard[4]);
    if (centerPiece && centerPiece.player === PLAYER_ME) score += 50;
    if (centerPiece && centerPiece.player === PLAYER_ENEMY) score -= 50;

    // 2. Line Potentials
    for (const line of WIN_LINES) {
        let myPieces = 0;
        let enemyPieces = 0;
        let empty = 0;
        
        for (const idx of line) {
            const p = getTopPiece(currentBoard[idx]);
            if (!p) empty++;
            else if (p.player === PLAYER_ME) myPieces++;
            else enemyPieces++;
        }

        if (myPieces === 2 && empty === 1) score += 20;
        if (enemyPieces === 2 && empty === 1) score -= 25; 
    }
    return score;
  };

  const getPossibleMoves = (currentBoard, player, inventory) => {
    const moves = [];
    const sizes = [3, 2, 1]; 
    
    for (let i = 0; i < 9; i++) {
        for (const size of sizes) {
            if (isValidMove(currentBoard, i, size, player, inventory)) {
                moves.push({ index: i, size });
            }
        }
    }
    return moves.sort((a, b) => b.size - a.size);
  };

  const minimax = (boardState, depth, alpha, beta, isMaximizing, myInventory, enemyInventory) => {
    const win = checkWinCondition(boardState);
    if (win === PLAYER_ME) return 10000 + depth; 
    if (win === PLAYER_ENEMY) return -10000 - depth; 
    if (depth === 0) return evaluateBoardState(boardState, PLAYER_ME);

    if (isMaximizing) {
        let maxEval = -Infinity;
        const moves = getPossibleMoves(boardState, PLAYER_ME, myInventory);
        if (moves.length === 0) return 0; // Draw

        for (const move of moves) {
            const nextInv = { ...myInventory, [move.size]: myInventory[move.size] - 1 };
            const nextBoard = simulateMove(boardState, move, PLAYER_ME);
            
            const evalScore = minimax(nextBoard, depth - 1, alpha, beta, false, nextInv, enemyInventory);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        const moves = getPossibleMoves(boardState, PLAYER_ENEMY, enemyInventory);
        if (moves.length === 0) return 0; // Draw

        for (const move of moves) {
            const nextInv = { ...enemyInventory, [move.size]: enemyInventory[move.size] - 1 };
            const nextBoard = simulateMove(boardState, move, PLAYER_ENEMY);
            
            const evalScore = minimax(nextBoard, depth - 1, alpha, beta, true, myInventory, nextInv);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
  };

  // --- AI Actions ---

  const calculateSuggestion = () => {
    setIsThinking(true);
    setTimeout(() => {
        let bestScore = -Infinity;
        let bestMove = null;
        const DEPTH = 4; 
        
        const moves = getPossibleMoves(board, PLAYER_ME, myInv);
        
        // Immediate Win
        for(const move of moves) {
            const nextBoard = simulateMove(board, move, PLAYER_ME);
            if(checkWinCondition(nextBoard) === PLAYER_ME) {
                setSuggestion({...move, reason: 'WIN NOW'});
                setIsThinking(false);
                return;
            }
        }

        for (const move of moves) {
            const nextInv = { ...myInv, [move.size]: myInv[move.size] - 1 };
            const nextBoard = simulateMove(board, move, PLAYER_ME);
            const score = minimax(nextBoard, DEPTH, -Infinity, Infinity, false, nextInv, enemyInv);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        setSuggestion(bestMove);
        setIsThinking(false);
    }, 50);
  };

  const performAiMove = () => {
      setIsThinking(true);
      setTimeout(() => {
        let bestScore = Infinity; // Enemy wants MIN score
        let bestMove = null;
        const DEPTH = 4;
        
        const moves = getPossibleMoves(board, PLAYER_ENEMY, enemyInv);
        
        // Immediate Win check for Enemy
        for(const move of moves) {
             const nextBoard = simulateMove(board, move, PLAYER_ENEMY);
             if(checkWinCondition(nextBoard) === PLAYER_ENEMY) {
                 executeMove(move, PLAYER_ENEMY);
                 setIsThinking(false);
                 return;
             }
        }

        // Minimax Loop (Enemy is Minimizer)
        for (const move of moves) {
             const nextInv = { ...enemyInv, [move.size]: enemyInv[move.size] - 1 };
             const nextBoard = simulateMove(board, move, PLAYER_ENEMY);
             
             // Next turn is MAX (Player ME)
             const score = minimax(nextBoard, DEPTH, -Infinity, Infinity, true, myInv, nextInv);
             
             if (score < bestScore) {
                 bestScore = score;
                 bestMove = move;
             }
        }
        
        // If no moves found (should be handled by draw check, but safety)
        if (bestMove) {
            executeMove(bestMove, PLAYER_ENEMY);
        }
        setIsThinking(false);
      }, 800); // Artificial delay for realism
  };

  const executeMove = (move, player) => {
      const newBoard = simulateMove(board, move, player);
      setBoard(newBoard);
      
      if (player === PLAYER_ME) {
          setMyInv(prev => ({ ...prev, [move.size]: prev[move.size] - 1 }));
      } else {
          setEnemyInv(prev => ({ ...prev, [move.size]: prev[move.size] - 1 }));
      }

      const win = checkWinCondition(newBoard);
      if (win) {
          setWinner(win);
      } else {
          // Check for Draw (Next player has no moves)
          const nextPlayer = player === PLAYER_ME ? PLAYER_ENEMY : PLAYER_ME;
          // Wait, we need real inventory for next turn check.
          // Easier: Just swap turn, let useEffect handle Draw logic.
          setCurrentTurn(nextPlayer);
      }
  };

  // --- Effects ---

  // Game Loop
  useEffect(() => {
    if (gameStarted && !winner) {
        setSuggestion(null);

        // 1. Win Check (Safety)
        const win = checkWinCondition(board);
        if (win) {
            setWinner(win);
            return;
        }

        // 2. Draw Check
        const inventory = currentTurn === PLAYER_ME ? myInv : enemyInv;
        const possibleMoves = getPossibleMoves(board, currentTurn, inventory);
        
        if (possibleMoves.length === 0) {
            setWinner(RESULT_DRAW);
            return;
        }

        // 3. Mode Specific Logic
        if (appMode === MODE_COMPANION) {
            // Suggestion Logic
            if (currentTurn === PLAYER_ME && autoSuggest && !isBoardEmpty(board)) {
                calculateSuggestion();
            }
        } else if (appMode === MODE_TRAINING) {
            // AI Turn Logic
            if (currentTurn === PLAYER_ENEMY) {
                performAiMove();
            }
        }
    }
  }, [board, currentTurn, myInv, enemyInv, gameStarted, winner, autoSuggest, appMode]);

  // --- Actions ---

  const handleStart = (playerIsFirst) => {
    setBoard(Array(9).fill(null).map(() => []));
    setMyInv({ ...INITIAL_INVENTORY });
    setEnemyInv({ ...INITIAL_INVENTORY });
    setWinner(null);
    setGameStarted(true);
    setCurrentTurn(playerIsFirst ? PLAYER_ME : PLAYER_ENEMY);
  };

  const handleCellClick = (index) => {
    if (!gameStarted || winner || !selectedPiece) return;

    // In Training Mode, can't click for Enemy
    if (appMode === MODE_TRAINING && currentTurn === PLAYER_ENEMY) return;
    
    // In Companion Mode, ensure we only click for current mirrored turn
    // (Though UI hides enemy interactions in Training, so this is mostly for Companion safety)
    if (selectedPiece.player !== currentTurn) return;

    const { player, size } = selectedPiece;
    const inventory = player === PLAYER_ME ? myInv : enemyInv;

    if (isValidMove(board, index, size, player, inventory)) {
        executeMove({ index, size }, player);
        setSelectedPiece(null);
    }
  };

  const handleReset = () => {
    setGameStarted(false);
    setAppMode(MODE_MENU);
    setBoard(Array(9).fill(null).map(() => []));
    setWinner(null);
    setSuggestion(null);
    setIsThinking(false);
  };

  // --- Render ---

  const renderPiece = (size, player, isGhost = false) => {
     const sizeClass = size === 3 ? 'w-16 h-16 text-2xl' : size === 2 ? 'w-10 h-10 text-xl' : 'w-6 h-6 text-sm';
     const colorClass = player === PLAYER_ME 
        ? 'bg-amber-500 border-amber-300 text-amber-950' 
        : 'bg-indigo-600 border-indigo-400 text-indigo-100';
     
     return (
        <div className={`
            rounded-full flex items-center justify-center font-bold border-2 shadow-sm
            ${sizeClass} ${colorClass}
            ${isGhost ? 'opacity-50 animate-pulse' : ''}
        `}>
            {size === 3 ? 'L' : size === 2 ? 'M' : 'S'}
        </div>
     );
  };

  const renderInventory = (player, inventory) => {
    const isMyInv = player === PLAYER_ME;
    const isActiveTurn = currentTurn === player;
    
    // In Training mode, disable Enemy inventory interactions entirely
    const isDisabled = appMode === MODE_TRAINING && !isMyInv;

    return (
        <div className={`
            flex flex-col items-center p-3 rounded-xl transition-all duration-300
            ${isActiveTurn ? (isMyInv ? 'bg-amber-900/30 ring-2 ring-amber-500' : 'bg-indigo-900/30 ring-2 ring-indigo-500') : 'opacity-60 grayscale'}
        `}>
            <span className={`text-xs font-bold uppercase mb-2 ${isMyInv ? 'text-amber-400' : 'text-indigo-400'}`}>
                {isMyInv ? 'My Inventory' : 'Enemy Inventory'}
            </span>
            <div className="flex gap-2">
                {[3, 2, 1].map(size => (
                    <button
                        key={size}
                        disabled={!isActiveTurn || inventory[size] === 0 || winner || isDisabled}
                        onClick={() => setSelectedPiece({ player, size })}
                        className={`
                            relative flex flex-col items-center justify-center w-12 h-14 rounded-lg border border-white/10 transition-all
                            ${selectedPiece?.player === player && selectedPiece?.size === size 
                                ? (isMyInv ? 'bg-amber-600 -translate-y-2 shadow-lg shadow-amber-900/50' : 'bg-indigo-600 -translate-y-2 shadow-lg shadow-indigo-900/50') 
                                : isDisabled ? 'bg-slate-800' : 'bg-slate-800 hover:bg-slate-700'
                            }
                            ${(inventory[size] === 0 || isDisabled) ? 'opacity-40 cursor-default' : ''}
                        `}
                    >
                        <span className="font-bold text-slate-200">{size === 3 ? 'L' : size === 2 ? 'M' : 'S'}</span>
                        <span className="text-[10px] bg-black/40 px-1.5 rounded mt-1">{inventory[size]}</span>
                    </button>
                ))}
            </div>
            {isActiveTurn && !winner && !isDisabled && (
                <div className="mt-2 text-[10px] font-bold animate-pulse text-white/50">
                    Select piece
                </div>
            )}
             {isDisabled && isActiveTurn && !winner && (
                <div className="mt-2 text-[10px] font-bold animate-pulse text-indigo-300">
                    AI Thinking...
                </div>
            )}
        </div>
    );
  };

  // --- Screens ---

  if (appMode === MODE_MENU) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200 font-sans">
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 to-purple-400 mb-2">
                Celestial Code
              </h1>
              <p className="text-slate-500 mb-8">Master the board.</p>
              
              <div className="grid gap-4 w-full max-w-sm">
                  <button 
                    onClick={() => setAppMode(MODE_COMPANION)}
                    className="p-6 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-2xl transition-all group flex items-center justify-between"
                  >
                     <div className="flex flex-col items-start">
                         <span className="text-xl font-bold text-amber-100 group-hover:text-amber-400 transition-colors">Companion Mode</span>
                         <span className="text-xs text-slate-400">Mirror your in-game moves. Get hints.</span>
                     </div>
                     <Swords className="text-slate-600 group-hover:text-amber-500 transition-colors" size={32} />
                  </button>

                  <button 
                    onClick={() => setAppMode(MODE_TRAINING)}
                    className="p-6 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-2xl transition-all group flex items-center justify-between"
                  >
                     <div className="flex flex-col items-start">
                         <span className="text-xl font-bold text-indigo-100 group-hover:text-indigo-400 transition-colors">Training Mode</span>
                         <span className="text-xs text-slate-400">Play against the Full-Power AI.</span>
                     </div>
                     <Bot className="text-slate-600 group-hover:text-indigo-500 transition-colors" size={32} />
                  </button>
              </div>
          </div>
      );
  }

  if (!gameStarted) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200 font-sans">
              <div className="w-full max-w-sm mb-6 flex items-center gap-2 text-slate-500 cursor-pointer hover:text-white" onClick={() => setAppMode(MODE_MENU)}>
                 <span>← Back to Menu</span>
              </div>
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-sm w-full">
                  <h2 className="text-2xl font-bold mb-6 text-center text-white">
                      {appMode === MODE_COMPANION ? "Companion Setup" : "Training Setup"}
                  </h2>
                  <p className="text-center mb-6 text-slate-400 text-sm">
                      {appMode === MODE_COMPANION ? "Who is moving first in the real game?" : "Do you want to move first or second?"}
                  </p>
                  <button 
                    onClick={() => handleStart(true)}
                    className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 rounded-xl font-bold text-lg mb-4 hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
                  >
                    {appMode === MODE_COMPANION ? "I am Ivory (Move First)" : "Play as First Player"}
                  </button>
                  <button 
                    onClick={() => handleStart(false)}
                    className="w-full py-4 bg-slate-800 rounded-xl font-bold text-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {appMode === MODE_COMPANION ? "I am Ebony (Move Second)" : "Play as Second Player"}
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-2 flex flex-col items-center max-w-lg mx-auto">
      
      {/* Top Bar */}
      <div className="w-full flex justify-between items-center mb-4 pt-2">
         <h2 className="font-bold text-lg flex items-center gap-2 text-slate-300">
            {appMode === MODE_TRAINING ? <Bot size={18} /> : <Cpu size={18} />} 
            {appMode === MODE_TRAINING ? "Training Arena" : "Celestial Engine"}
         </h2>
         <div className="flex gap-2">
            {appMode === MODE_COMPANION && (
                <button 
                    onClick={() => setAutoSuggest(!autoSuggest)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border ${autoSuggest ? 'bg-green-900/40 border-green-500 text-green-300' : 'bg-slate-800 border-slate-600 text-slate-500'}`}
                >
                    <Zap size={10} /> Auto-Suggest: {autoSuggest ? 'ON' : 'OFF'}
                </button>
            )}
            <button onClick={handleReset} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400">
                <RefreshCw size={16} />
            </button>
         </div>
      </div>

      {/* Enemy Area (Top) */}
      <div className="w-full mb-4">
         {renderInventory(PLAYER_ENEMY, enemyInv)}
      </div>

      {/* Center Message / Suggestion */}
      <div className="h-16 w-full flex items-center justify-center mb-2 px-2">
         {winner ? (
             <div className={`
                px-6 py-2 rounded-lg font-black text-xl animate-bounce 
                ${winner === PLAYER_ME ? 'bg-amber-500 text-black' : 
                  winner === PLAYER_ENEMY ? 'bg-indigo-500 text-white' : 
                  'bg-slate-600 text-white'}
             `}>
                 {winner === PLAYER_ME ? 'VICTORY' : winner === PLAYER_ENEMY ? 'DEFEAT' : 'DRAW GAME'}
             </div>
         ) : currentTurn === PLAYER_ME ? (
             <div className="flex w-full items-center justify-between gap-3 bg-amber-950/40 px-3 py-2 rounded-lg border border-amber-500/30">
                 <div className="flex items-center gap-3">
                    <User className={`text-amber-400 w-5 h-5 ${isThinking ? 'animate-spin' : ''}`} />
                    <div className="flex flex-col">
                        <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">Your Turn</span>
                        <span className="text-sm font-medium text-amber-100">
                            {isThinking ? 'Thinking...' :
                            appMode === MODE_COMPANION && suggestion ? `Tip: Place ${suggestion.size === 3 ? 'Large' : suggestion.size === 2 ? 'Medium' : 'Small'}` :
                            'Select a piece'}
                        </span>
                    </div>
                 </div>
                 
                 {appMode === MODE_COMPANION && !suggestion && !isThinking && (
                     <button 
                        onClick={calculateSuggestion}
                        className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded font-bold flex items-center gap-1 shadow-lg shadow-amber-900/50"
                     >
                        <Lightbulb size={12} /> Suggest
                     </button>
                 )}
             </div>
         ) : (
            <div className="text-slate-500 text-sm flex items-center gap-2 animate-pulse bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
                {appMode === MODE_TRAINING ? <Bot size={16} /> : <ShieldAlert size={16} />}
                {appMode === MODE_TRAINING ? "AI is plotting..." : "Waiting for Enemy..."}
            </div>
         )}
      </div>

      {/* Board */}
      <div className="relative bg-[#dccfab] p-2 rounded shadow-2xl border-[6px] border-[#6b5b3a]">
         <div className="grid grid-cols-3 gap-1 bg-[#6b5b3a] w-fit mx-auto">
            {board.map((stack, index) => {
                const topPiece = getTopPiece(stack);
                const isSuggestionTarget = appMode === MODE_COMPANION && suggestion && suggestion.index === index && currentTurn === PLAYER_ME;
                
                return (
                    <button
                        key={index}
                        onClick={() => handleCellClick(index)}
                        className={`
                            w-24 h-24 relative bg-[#eaddb6] flex items-center justify-center
                            hover:bg-[#f6ebd0] active:scale-95 transition-all
                            ${isSuggestionTarget ? 'ring-[6px] ring-inset ring-green-500 bg-green-500/20' : ''}
                        `}
                    >
                        {/* Piece Render */}
                        {topPiece && renderPiece(topPiece.size, topPiece.player)}

                        {/* Suggestion Ghost */}
                        {isSuggestionTarget && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                {renderPiece(suggestion.size, PLAYER_ME, true)}
                            </div>
                        )}
                    </button>
                );
            })}
         </div>
      </div>

      {/* My Area (Bottom) */}
      <div className="w-full mt-4">
         {renderInventory(PLAYER_ME, myInv)}
      </div>

    </div>
  );
}
