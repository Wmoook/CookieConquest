// Main Entry Point - Initialize game and bind events
document.addEventListener('DOMContentLoaded', () => {
    // Initialize audio
    audioManager.init();
    
    // Connect to server
    gameClient.connect();
    
    // Event handlers
    gameClient.on('connected', () => {
        console.log('Connected to Cookie Conquest server');
    });
    
    gameClient.on('welcome', (data) => {
        uiManager.updateBalance(data.balance);
    });
    
    gameClient.on('name_set', (data) => {
        uiManager.enableMenuButtons();
        uiManager.showNotification(`Welcome, ${data.name}!`, 'success');
    });
    
    gameClient.on('balance_updated', (data) => {
        uiManager.updateBalance(data.balance);
        uiManager.showNotification('Balance updated!', 'success');
    });
    
    gameClient.on('lobbies_list', (lobbies) => {
        uiManager.updateLobbies(lobbies);
    });
    
    gameClient.on('match_created', (data) => {
        uiManager.updateBalance(data.balance);
        uiManager.showScreen('matchLobby');
    });
    
    gameClient.on('match_joined', (data) => {
        uiManager.updateBalance(data.balance);
        uiManager.showScreen('matchLobby');
    });
    
    gameClient.on('match_state', (data) => {
        uiManager.updateMatchLobby(data);
    });
    
    gameClient.on('match_started', (data) => {
        uiManager.showScreen('gameScreen');
        uiManager.showNotification('Match started! Good luck!', 'success');
        audioManager.playCountdown();
    });
    
    gameClient.on('game_state', (data) => {
        uiManager.updateGameState(data);
        
        // Play bakeoff sound when entering that phase
        if (data.phase === 'bakeoff' && !gameClient._bakeoffAnnounced) {
            gameClient._bakeoffAnnounced = true;
            audioManager.playBakeoff();
            uiManager.showNotification('BAKE-OFF BEGINS! 2x Click Multiplier!', 'warning');
        }
    });
    
    gameClient.on('click_result', (data) => {
        if (data.success) {
            uiManager.showClickFeedback(data);
        }
    });
    
    gameClient.on('generator_result', (data) => {
        if (data.success) {
            audioManager.playPurchase();
            uiManager.showNotification(`Bought ${data.generatorType}!`, 'success');
        } else {
            uiManager.showNotification(data.reason || 'Purchase failed', 'danger');
        }
    });
    
    gameClient.on('bluff_result', (data) => {
        if (data.success) {
            audioManager.playPurchase();
            uiManager.showNotification(`Activated ${data.bluffType}!`, 'success');
        } else {
            uiManager.showNotification(data.reason || 'Bluff failed', 'danger');
        }
    });
    
    gameClient.on('cookie_call_result', (data) => {
        const isMe = data.callerId === gameClient.playerId || data.targetId === gameClient.playerId;
        
        if (data.correct) {
            if (data.callerId === gameClient.playerId) {
                audioManager.playVictory();
                uiManager.showNotification(`Correct call! Stole ${data.stolenAmount} cookies from ${data.targetName}!`, 'success');
            } else if (data.targetId === gameClient.playerId) {
                audioManager.playSabotage();
                uiManager.showNotification(`${data.callerName} caught your bluff! Lost ${data.stolenAmount} cookies!`, 'danger');
            } else if (isMe === false) {
                uiManager.showNotification(`${data.callerName} caught ${data.targetName} bluffing!`, 'warning');
            }
        } else {
            if (data.callerId === gameClient.playerId) {
                audioManager.playDefeat();
                uiManager.showNotification(`Wrong call! Lost ${data.lostAmount} cookies!`, 'danger');
            } else if (data.targetId === gameClient.playerId) {
                audioManager.playBlocked();
                uiManager.showNotification(`${data.callerName} called your bluff incorrectly! You gained a buff!`, 'success');
            } else if (isMe === false) {
                uiManager.showNotification(`${data.callerName} made a wrong call on ${data.targetName}!`, 'warning');
            }
        }
    });
    
    gameClient.on('sabotage_used', (data) => {
        if (data.targetId === gameClient.playerId) {
            if (data.blocked) {
                audioManager.playBlocked();
                uiManager.showNotification('Sabotage blocked!', 'success');
            } else {
                audioManager.playSabotage();
                uiManager.showNotification(`You were hit by ${data.sabotageType}!`, 'danger');
                document.querySelector('.game-container').classList.add('sabotage-hit');
                setTimeout(() => {
                    document.querySelector('.game-container').classList.remove('sabotage-hit');
                }, 500);
            }
        } else if (data.attackerId === gameClient.playerId) {
            if (data.blocked) {
                uiManager.showNotification('Your sabotage was blocked!', 'warning');
            } else {
                uiManager.showNotification('Sabotage successful!', 'success');
            }
        }
    });
    
    gameClient.on('sabotage_result', (data) => {
        if (!data.success) {
            uiManager.showNotification(data.reason || 'Sabotage failed', 'danger');
        }
    });
    
    gameClient.on('defense_result', (data) => {
        if (data.success) {
            audioManager.playPurchase();
            uiManager.showNotification(`Bought ${data.defenseType}!`, 'success');
        } else {
            uiManager.showNotification(data.reason || 'Purchase failed', 'danger');
        }
    });
    
    gameClient.on('match_ended', (data) => {
        gameClient._bakeoffAnnounced = false;
        uiManager.showResults(data);
    });
    
    gameClient.on('error', (data) => {
        uiManager.showNotification(data.message || 'An error occurred', 'danger');
    });
    
    gameClient.on('disconnected', () => {
        uiManager.showNotification('Disconnected from server. Reconnecting...', 'warning');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Space bar for clicking cookie during game
        if (e.code === 'Space' && uiManager.screens.gameScreen.classList.contains('active')) {
            e.preventDefault();
            uiManager.elements.mainCookie.click();
        }
    });
    
    console.log('Cookie Conquest initialized!');
});
