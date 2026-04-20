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
    'welcome_alert': {
        frames: [
            {
                text: "Welcome to Burger Joint! <br><br>The big green bar is your Enployment Meter.<br> When it hits zero, you're fired! HARHARHAR!<br><br>It fills up when you complete a ticket.<br> The more tickets waiting on the line, the faster it depletes, so keep your butt moving.",
                position: 'center',
                size: { width: '700px', height: '400px' },
                portrait: '/assets/ui/wellington_portrait.png',
                portraitSide: 'left',
                portraitVAlign: 'top'
            }
        ]
    },
    'container_tutorial_1': {
        frames: [
            {
                text: "PRIMARY BUTTON: {PICK_UP}<br><br>Press this to pick things up and put them down.",
                position: 'center',
                size: { width: '700px', height: '400px' },
                next: 'container_tutorial_2'
            }
        ]
    },
    'container_tutorial_2': {
        frames: [
            {
                text: "SECONDARY BUTTON: {INTERACT}<br><br>Press this to take one thing <br>from a container or stack.",
                position: 'center',
                size: { width: '700px', height: '400px' }
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
                size: { width: '640px', height: '280px' },
                buttons: [
                    { label: 'Faster Tickets', subLabel: '+20% speed', image: '/assets/ui/button_background-boil.png', action: 'faster_tickets' },
                    { label: 'More Complexity', image: '/assets/ui/button_background-boil.png', action: 'more_complexity' }
                ]
            }
        ]
    }
};
