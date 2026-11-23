export const ALERTS = {
    'ticket_timeout': {
        frames: [
            {
                text: "Too slow!",
                position: 'center',
                size: { width: '300px', height: '150px' },
                buttons: [
                    {
                        id: 'restart_button',
                        text: 'Restart!',
                        action: 'dismiss'
                    }
                ]
            }
        ]
    },

    'unlock_alert': {
        frames: [
            {
                text: "Unlocked {itemName}!",
                position: 'center',
                size: { width: '600px', height: '400px' },
                buttons: [
                    {
                        action: 'dismiss'
                    }
                ]
            }
        ]
    },
    'tickets_reminder': {
        frames: [
            {
                text: "Press SHIFT to check your pending tickets!",
                position: 'center',
                size: { width: '500px', height: '150px' }
            }
        ]
    },
    'level_up': {
        frames: [
            {
                text: "{upgradeLabel}",
                position: 'center',
                size: { width: '956px', height: '656px' },
                buttons: [] // Dynamically populated
            }
        ]
    }
};
