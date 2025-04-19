// ==UserScript==
// @name         Message Reminder Enhanced
// @version      1.0.0
// @description  Fully featured, persistent reminders, list management, and rich UI
// @author       .Diabelo & ItsAlex
// ==/UserScript==

import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { sendBotMessage } from "@api/Commands";
import { SelectedChannelStore } from "@webpack/common";
import { localStorage } from "@utils/localStorage";

interface Reminder {
    message: string;
    timestamp: number;
    id: string;
    triggered: boolean;
}

// Global state management
let activeReminders: Reminder[] = [];
let globalCheckInterval: NodeJS.Timeout | null = null;

/**
 * Checks all active reminders and triggers those that have reached their scheduled time
 * Sends notifications for triggered reminders and updates their status
 */
function checkReminders() {
    const currentTime = Date.now();
    const channelId = SelectedChannelStore.getChannelId();

    if (!channelId) return;

    const remindersToTrigger = activeReminders.filter(reminder =>
        currentTime >= reminder.timestamp && !reminder.triggered
    );

    remindersToTrigger.forEach(reminder => {
        showMessage(reminder.message, 'trigger', currentTime);
        reminder.triggered = true;
        saveRemindersToStorage();
    });
}

/**
 * Saves the current state of reminders to localStorage
 * Converts the reminders array to a serializable format before storage
 */
function saveRemindersToStorage() {
    const remindersToSave = activeReminders.map(reminder => ({
        message: reminder.message,
        timestamp: reminder.timestamp,
        id: reminder.id,
        triggered: reminder.triggered
    }));
    localStorage.setItem('equicord-reminders', JSON.stringify(remindersToSave));
}

/**
 * Loads saved reminders from localStorage
 * Handles potential parsing errors and initializes empty array if no saved data exists
 */
function loadRemindersFromStorage() {
    const savedReminders = localStorage.getItem('equicord-reminders');
    if (savedReminders) {
        try {
            activeReminders = JSON.parse(savedReminders);
        } catch (e) {
            console.error("Failed to parse reminders:", e);
            activeReminders = [];
        }
    }
}

/**
 * Displays a reminder message in the chat
 * @param {string} message - The content of the reminder
 * @param {'set' | 'trigger'} type - Whether the message is for setting or triggering a reminder
 * @param {any} exprireAt - Optional timestamp for when the reminder expires
 */
function showMessage(message: string, type: 'set' | 'trigger' = 'trigger', exprireAt?: any) {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) return;

    const emoji = type === 'set' ? '⏰' : '🔔';

    const embed: any = {
        description: message,
        color: type === 'set' ? 0x5865F2 : 0xED4245,
        title: type === 'set' ? '⏰ Reminder Set ⏰' : '🔔 Reminder 🔔',
        footer: {
            text: type === 'set' ? 'Reminder will trigger' : 'Reminder triggered'
        },
        timestamp: new Date(exprireAt).toISOString(),
    };

    sendBotMessage(channelId, {
        content: "",
        username: `${emoji} Reminder ${emoji}`,
        avatar_url: "",
        embeds: [embed]
    } as any);

    if (type === 'trigger') {
        try {
            const audio = new Audio();
            audio.src = "https://discord.com/assets/dd920c06a01e5bb8b09678581e29d56f.mp3";
            audio.volume = 0.5;
            audio.play();
        } catch (e) {
            console.error("Could not play notification sound:", e);
        }
    }
}

/**
 * Creates a new reminder with the specified message and duration
 * @param {string} message - The reminder message
 * @param {number} timeInSeconds - Duration until reminder triggers in seconds
 */
function setReminder(message: string, timeInSeconds: number) {
    const reminderTime = Date.now() + (timeInSeconds * 1000);
    const id = Math.random().toString(36).substr(2, 9);

    const reminder: Reminder = {
        message,
        timestamp: reminderTime,
        id,
        triggered: false
    };

    activeReminders.push(reminder);
    saveRemindersToStorage();
    showMessage(message, 'set', reminderTime);
}

/**
 * Creates and displays the reminder form modal
 * Handles user input and form submission
 */
function openReminderForm() {
    loadRemindersFromStorage();
    const formContainer = document.createElement("div");
    formContainer.className = "reminder-form-modal";

    const style = document.createElement("style");
    style.textContent = `
        .reminder-form-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: #313338;
            padding: 24px;
            border-radius: 12px;
            color: white;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 0 0 1px rgba(32,34,37,.6), 0 2px 10px 0 rgba(0,0,0,.2);
            min-width: 400px;
            animation: scaleIn 0.2s ease;
        }
        .reminder-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        .reminder-header svg {
            width: 24px;
            height: 24px;
            color: #b9bbbe;
        }
        .reminder-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #fff;
            margin: 0;
        }
        .reminder-input {
            padding: 10px;
            background: #1e1f22;
            border: none;
            border-radius: 4px;
            color: #dcddde;
            font-size: 1rem;
            transition: border-color 0.2s ease;
        }
        .reminder-input:focus {
            outline: none;
            box-shadow: 0 0 0 2px #5865f2;
        }
        .reminder-button {
            padding: 12px;
            background: #5865f2;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        .reminder-button:hover {
            background: #4752c4;
        }
        .reminder-button:active {
            background: #3c45a5;
        }
        .reminder-close {
            position: absolute;
            right: 16px;
            top: 16px;
            background: none;
            border: none;
            color: #b9bbbe;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }
        .reminder-close:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .reminder-input-group {
            display: flex;
            justify-content: space-around;
            gap: 8px;
            width: 100%;
        }
        .reminder-input-group input[type="number"] {
            flex: 1;
        }
        .reminder-history-button {
            flex: 2;
            width: 100%;
            padding: 10px;
            background: #4f545c;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        .reminder-history-button:hover {
            background: #686d76;
        }
        .reminder-history-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            background: #313338;
            padding: 24px;
            border-radius: 12px;
            color: white;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: 0 0 0 1px rgba(32,34,37,.6), 0 2px 10px 0 rgba(0,0,0,.2);
            min-width: 500px;
            max-height: 75vh;
            overflow-y: overlay;
            overflow-x: hidden;
            animation: scaleIn 0.2s ease;
        }
        .reminder-history-modal::-webkit-scrollbar {
            display: none;
        }
        .reminder-history-modal:hover::-webkit-scrollbar {
            display: none;
        }
        .reminder-tabs {
            display: flex;
            gap: 2px;
            background: #2b2d31;
            padding: 2px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .reminder-tab {
            flex: 1;
            padding: 8px;
            text-align: center;
            background: transparent;
            border: none;
            color: #b9bbbe;
            cursor: pointer;
            border-radius: 3px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        .reminder-tab.active {
            background: #404249;
            color: white;
        }
        .reminder-tab:hover:not(.active) {
            background: rgba(64, 66, 73, 0.3);
            color: #dcddde;
        }
        .reminder-history-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .reminder-history-empty {
            text-align: center;
            padding: 20px;
            color: #b9bbbe;
            font-style: italic;
        }
        .reminder-history-item {
            background: #1e1f22;
            padding: 12px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }
        .reminder-history-item-content {
            flex: 1;
        }
        .reminder-history-item-time {
            color: #b9bbbe;
            font-size: 0.9rem;
        }
        .reminder-history-item-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        .reminder-history-item-status.active {
            background: #5865f2;
            color: white;
        }
        .reminder-history-item-status.expired {
            background: #ed4245;
            color: white;
        }
        .reminder-history-delete {
            background: none;
            border: none;
            color: #ed4245;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
        }
        .reminder-history-delete:hover {
            background: rgba(237, 66, 69, 0.1);
        }
        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: translate(-50%, -48%) scale(0.96);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
    `;
    document.head.appendChild(style);

    formContainer.innerHTML = `
        <div class="reminder-header">
            <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 22q-.825 0-1.413-.588T10 20h4q0 .825-.588 1.413T12 22Zm-9-3v-2h2v-7q0-2.925 1.95-5.075T12 2q3.1 0 5.05 2.15T19 9v7h2v2H3Z"/>
            </svg>
            <h3 class="reminder-title">Set Reminder</h3>
        </div>
        <button class="reminder-close">×</button>
        <input type="text" class="reminder-input" placeholder="What would you like to be reminded about?" />
        <div class="reminder-input-group">
            <input type="number" class="reminder-input" placeholder="Time" min="1" />
            <select class="reminder-input">
                <option value="60">Minutes</option>
                <option value="1">Seconds</option>
                <option value="3600">Hours</option>
            </select>
            <button class="reminder-history-button">History</button>
        </div>
        <button class="reminder-button">Set Reminder</button>
    `;

    document.body.appendChild(formContainer);

    const closeBtn = formContainer.querySelector('.reminder-close') as HTMLButtonElement;
    const messageInput = formContainer.querySelector('input[type="text"]') as HTMLInputElement;
    const timeInput = formContainer.querySelector('input[type="number"]') as HTMLInputElement;
    const unitSelect = formContainer.querySelector('select') as HTMLSelectElement;
    const submitBtn = formContainer.querySelector('.reminder-button') as HTMLButtonElement;
    const historyBtn = formContainer.querySelector('.reminder-history-button') as HTMLButtonElement;

    function openHistoryModal() {
        const historyModal = document.createElement("div");
        historyModal.className = "reminder-history-modal";

        formContainer.style.display = 'none';
        historyModal.innerHTML = `
            <div class="reminder-header">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 22q-.825 0-1.413-.588T10 20h4q0 .825-.588 1.413T12 22Zm-9-3v-2h2v-7q0-2.925 1.95-5.075T12 2q3.1 0 5.05 2.15T19 9v7h2v2H3Z"/>
                </svg>
                <h3 class="reminder-title">Reminder History</h3>
            </div>
            <button class="reminder-close">×</button>
            <div class="reminder-tabs">
                <button class="reminder-tab active" data-tab="active">Active</button>
                <button class="reminder-tab" data-tab="expired">Expired</button>
            </div>
            <div class="reminder-history-list"></div>
        `;

        const historyList = historyModal.querySelector('.reminder-history-list') as HTMLDivElement;
        const closeHistoryBtn = historyModal.querySelector('.reminder-close') as HTMLButtonElement;
        const tabs = historyModal.querySelectorAll('.reminder-tab') as NodeListOf<HTMLButtonElement>;
        let activeTab = 'active';

        function updateHistoryList() {
            historyList.innerHTML = '';
            const currentTime = Date.now();

            const filteredReminders = activeReminders.filter(reminder => {
                const isExpired = currentTime >= reminder.timestamp;
                return activeTab === 'active' ? !isExpired : isExpired;
            });

            if (filteredReminders.length === 0) {
                historyList.innerHTML = `
                    <div class="reminder-history-empty">
                        No ${activeTab} reminders found
                    </div>
                `;
                return;
            }

            filteredReminders.forEach(reminder => {
                const isExpired = currentTime >= reminder.timestamp;
                const status = isExpired ? 'expired' : 'active';
                const date = new Date(reminder.timestamp);

                const item = document.createElement('div');
                item.className = 'reminder-history-item';
                item.innerHTML = `
                    <div class="reminder-history-item-content">
                        <div>${reminder.message}</div>
                        <div class="reminder-history-item-time">${date.toLocaleString()}</div>
                    </div>
                    <div class="reminder-history-item-status ${status}">${status.toUpperCase()}</div>
                    <button class="reminder-history-delete">×</button>
                `;

                const deleteBtn = item.querySelector('.reminder-history-delete') as HTMLButtonElement;
                deleteBtn.onclick = () => {
                    activeReminders = activeReminders.filter(r => r.id !== reminder.id);
                    saveRemindersToStorage();
                    updateHistoryList();
                };

                historyList.appendChild(item);
            });
        }

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeTab = tab.dataset.tab || 'active';
                updateHistoryList();
            };
        });

        closeHistoryBtn.onclick = () => {
            historyModal.remove();
            formContainer.style.display = 'flex';
        };

        updateHistoryList();
        document.body.appendChild(historyModal);
    }

    historyBtn.onclick = openHistoryModal;

    closeBtn.onclick = () => {
        formContainer.remove();
        style.remove();
    };

    submitBtn.onclick = () => {
        const msg = messageInput.value.trim();
        const time = parseInt(timeInput.value);
        const multiplier = parseInt(unitSelect.value);

        if (!msg) {
            messageInput.style.boxShadow = "0 0 0 2px #ed4245";
            return;
        }
        if (isNaN(time) || time <= 0) {
            timeInput.style.boxShadow = "0 0 0 2px #ed4245";
            return;
        }

        setReminder(msg, time * multiplier);
        formContainer.remove();
        style.remove();
    };

    messageInput.focus();
}

/**
 * Chat bar button component for the reminder feature
 * Displays a bell icon and opens the reminder form on click
 */
const ChatBarIcon: ChatBarButtonFactory = () => (
    <ChatBarButton tooltip="Set Reminder" onClick={openReminderForm}>
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 22q-.825 0-1.413-.588T10 20h4q0 .825-.588 1.413T12 22Zm-9-3v-2h2v-7q0-2.925 1.95-5.075T12 2q3.1 0 5.05 2.15T19 9v7h2v2H3Z" />
        </svg>
    </ChatBarButton>
);

export default definePlugin({
    name: "Message Reminder",
    description: "Set reminders with beautiful notifications",
    authors: [EquicordDevs.Diabelo, EquicordDevs.ItsAlex],
    start: () => {
        loadRemindersFromStorage();
        addChatBarButton("Reminder", ChatBarIcon);

        globalCheckInterval = setInterval(() => {
            checkReminders();
        }, 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkReminders();
            }
        });
    },
    stop: () => {
        removeChatBarButton("Reminder");
        removeChatBarButton("RemindersList");
        if (globalCheckInterval) clearInterval(globalCheckInterval);
        activeReminders = [];
        localStorage.removeItem('equicord-reminders');
    }
});