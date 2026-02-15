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

    'daily_rating_0': {
        frames: [
            {
                text: "0/5",
                position: 'center',
                size: { width: '300px', height: '150px' }
            }
        ]
    },
    'daily_rating_1': {
        frames: [
            {
                text: "1/5",
                position: 'center',
                size: { width: '300px', height: '150px' }
            }
        ]
    },
    'daily_rating_2': {
        frames: [
            {
                text: "2/5",
                position: 'center',
                size: { width: '300px', height: '150px' }
            }
        ]
    },
    'daily_rating_3': {
        frames: [
            {
                text: "3/5",
                position: 'center',
                size: { width: '300px', height: '150px' }
            }
        ]
    },
    'daily_rating_4': {
        frames: [
            {
                text: "4/5",
                position: 'center',
                size: { width: '300px', height: '150px' }
            }
        ]
    },
    'daily_rating_5': {
        frames: [
            {
                text: "5/5",
                position: 'center',
                size: { width: '300px', height: '150px' }
            }
        ]
    },
    'unlock_alert': {
        type: 'unlock_minigame',
        frames: [
            {
                text: "{itemName} added to menu! Check your store room!",
                position: 'center',
                size: { width: '400px', height: '200px' },
                buttons: [
                    {
                        text: 'Awesome!',
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
                text: "While empty handed:<br><br>Press {PICK_UP} to pick up containers.<br><br>Press {INTERACT} to take one thing from containers.",
                position: 'center',
                size: { width: '700px', height: '400px' },
                next: 'container_tutorial_2'
            }
        ]
    },
    'container_tutorial_2': {
        frames: [
            {
                text: "While holding a container:<br><br> Press {PICK_UP} to put down the container.<br><br> Press {INTERACT} to deal one thing from the container.",
                position: 'center',
                size: { width: '700px', height: '400px' }
            }
        ]
    }
};
