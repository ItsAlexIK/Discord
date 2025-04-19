/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { sendBotMessage } from "@api/Commands";
import { SelectedChannelStore } from "@webpack/common";
import { localStorage } from "@utils/localStorage";
import { useState, useEffect } from "@webpack/common";
import { Button, TextInput } from "@webpack/common";
import "./styles.css";

interface Reminder {
    message: string;
    timestamp: number;
    id: string;
    triggered: boolean;
}

// Global state management
let activeReminders: Reminder[] = [];
let globalCheckInterval: NodeJS.Timeout | null = null;

function ReminderForm({ onClose }: { onClose: () => void; }) {
    const [message, setMessage] = useState("");
    const [time, setTime] = useState("");
    const [unit, setUnit] = useState("60");
    const [showHistory, setShowHistory] = useState(false);

    const handleSubmit = () => {
        if (!message.trim()) return;
        const timeValue = parseInt(time);
        if (isNaN(timeValue) || timeValue <= 0) return;

        setReminder(message, timeValue * parseInt(unit));
        onClose();
    };

    return (
        <div className="reminder-form-modal">
            <div className="reminder-header">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 22c-.825 0-1.413-.587-1.413-1.412h4c0 .825-.588 1.412-1.413 1.412H12Zm-9-3v-2h2V9c0-2.925 1.95-5.075 4.95-5.075 3.1 0 5.05 2.15 5.05 5.075v7h2v2H3Z" />
                </svg>
                <h3 className="reminder-title">Set Reminder</h3>
                <button className="reminder-close" onClick={onClose}>×</button>
            </div>
            <div className="reminder-content">
                <TextInput
                    value={message}
                    onChange={setMessage}
                    placeholder="What would you like to be reminded about?"
                    className="reminder-input"
                />
                <div className="reminder-input-group">
                    <TextInput
                        type="number"
                        value={time}
                        onChange={setTime}
                        placeholder="Time"
                        min="1"
                        className="reminder-input"
                    />
                    <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="reminder-input"
                    >
                        <option value="60">Minutes</option>
                        <option value="1">Seconds</option>
                        <option value="3600">Hours</option>
                    </select>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="reminder-history-button"
                    >
                        History
                    </button>
                </div>
                <button
                    onClick={handleSubmit}
                    className="reminder-button"
                    style={{ marginTop: "16px" }}
                >
                    Set Reminder
                </button>
            </div>
            {showHistory && <ReminderHistory onClose={() => setShowHistory(false)} />}
        </div>
    );
}

function ReminderHistory({ onClose }: { onClose: () => void; }) {
    const [activeTab, setActiveTab] = useState("expired");
    const currentTime = Date.now();

    const filteredReminders = activeReminders.filter(reminder => {
        const isExpired = currentTime >= reminder.timestamp;
        return activeTab === "active" ? !isExpired : isExpired;
    });

    return (
        <div className="reminder-history-modal">
            <div className="reminder-header">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 22c-.825 0-1.413-.587-1.413-1.412h4c0 .825-.588 1.412-1.413 1.412H12Zm-9-3v-2h2V9c0-2.925 1.95-5.075 4.95-5.075 3.1 0 5.05 2.15 5.05 5.075v7h2v2H3Z" />
                </svg>
                <h3 className="reminder-title">Reminder History</h3>
                <button className="reminder-close" onClick={onClose}>×</button>
            </div>
            <div className="reminder-content">
                <div className="reminder-tabs">
                    <button
                        className={`reminder-tab ${activeTab === "active" ? "active" : ""}`}
                        onClick={() => setActiveTab("active")}
                    >
                        Active
                    </button>
                    <button
                        className={`reminder-tab ${activeTab === "expired" ? "active" : ""}`}
                        onClick={() => setActiveTab("expired")}
                    >
                        Expired
                    </button>
                </div>
                <div className="reminder-history-list">
                    {filteredReminders.length === 0 ? (
                        <div className="reminder-history-empty">
                            No {activeTab} reminders found
                        </div>
                    ) : (
                        filteredReminders.map(reminder => {
                            const date = new Date(reminder.timestamp);
                            return (
                                <div key={reminder.id} className="reminder-history-item">
                                    <div className="reminder-history-item-content">
                                        <div>{reminder.message}</div>
                                        <div className="reminder-history-item-time">
                                            {date.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="reminder-history-item-status">
                                        EXPIRED
                                    </div>
                                    <button
                                        onClick={() => {
                                            activeReminders = activeReminders.filter(r => r.id !== reminder.id);
                                            saveRemindersToStorage();
                                        }}
                                        className="reminder-history-delete"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Checks all active reminders and triggers those that have reached their scheduled time
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

const ChatBarIcon: ChatBarButtonFactory = () => {
    const [showForm, setShowForm] = useState(false);

    return (
        <>
            <ChatBarButton tooltip="Set Reminder" onClick={() => setShowForm(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12 22c-.825 0-1.413-.587-1.413-1.412h4c0 .825-.588 1.412-1.413 1.412H12Zm-9-3v-2h2V9c0-2.925 1.95-5.075 4.95-5.075 3.1 0 5.05 2.15 5.05 5.075v7h2v2H3Z" />
                </svg>
            </ChatBarButton>
            {showForm && <ReminderForm onClose={() => setShowForm(false)} />}
        </>
    );
};

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
        if (globalCheckInterval) clearInterval(globalCheckInterval);
        activeReminders = [];
        localStorage.removeItem('equicord-reminders');
    }
});
