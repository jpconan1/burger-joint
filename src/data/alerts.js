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
    'starter_selection': {
        frames: [
            {
                text: "PICK STARTERS",
                position: 'center',
                size: { width: '860px', height: '520px' },
                buttons: []
            }
        ]
    },
    'tutorial_recipe': {
        frames: [
            {
                text: "",
                recipeRows: [],
                position: 'center',
                size: { width: '760px', height: '420px' }
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
                text: "LEVEL UP! <br> Pick a topping to unlock!",
                position: 'center',
                size: { width: '956px', height: '656px' },
                buttons: [] // Dynamically populated
            }
        ]
    },
    'level_up_choice': {
        frames: [
            {
                text: "LEVEL UP!<br>Pick your reward.",
                position: 'center',
                size: { width: '760px', height: '360px' },
                buttons: [
                    { label: 'More Complexity', image: '/assets/ui/button_background-boil.png', action: 'more_complexity' },
                    { label: 'Faster Tickets', subLabel: '+20% speed', image: '/assets/ui/button_background-boil.png', action: 'faster_tickets' }
                ]
            }
        ]
    }
};
