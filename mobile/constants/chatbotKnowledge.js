/**
 * Chatbot knowledge base — the single source of truth for the in-app
 * AI assistant. Every fact mirrors what's presented in HelpScreen,
 * FareInfoScreen, and AboutScreen, so the bot never contradicts the UI.
 *
 * Each intent has:
 *   id        — unique key
 *   keywords  — lowercase tokens/phrases used by the scorer
 *   patterns  — optional regex patterns for higher-confidence matches
 *   answer    — the reply markdown-ish string (plain text + \n\n)
 *   actions   — optional deep-link quick replies shown under the reply
 *
 * An `action` is `{ label, screen }` where `screen` is one of the
 * ScreenKey values that mobile/app/index.tsx's openMenu/navigate
 * understands (e.g. 'FARE_INFO', 'HELP', 'RIDES', 'BOOKING').
 */

export const DISPATCH_PHONE = '(419) 207-8240';
export const DISPATCH_PHONE_TEL = 'tel:+14192078240';

export const INTENTS = [
    {
        id: 'greeting',
        keywords: ['hi', 'hello', 'hey', 'yo', 'howdy', 'hola', 'greetings'],
        patterns: [/^\s*(hi|hello|hey|yo|howdy|hola)\b/i],
        answer:
            "Hi! I'm APT Assist — your Ashland Public Transit helper.\n\n" +
            "I can answer questions about fares, booking, cancellations, the 30-minute pickup window, airport trips, and more. What can I help with?",
        actions: [
            { label: 'Book a ride', screen: 'BOOKING' },
            { label: 'See fares', screen: 'FARE_INFO' },
            { label: 'My rides', screen: 'RIDES' },
        ],
    },

    {
        id: 'thanks',
        keywords: ['thanks', 'thank you', 'thx', 'appreciate', 'cheers'],
        patterns: [/^\s*thank|thx|appreciate|cheers/i],
        answer: "You're welcome! Safe travels on Ashland Public Transit. 🚐",
    },

    {
        id: 'bye',
        keywords: ['bye', 'goodbye', 'see ya', 'later'],
        patterns: [/^\s*(bye|goodbye|later)\b/i],
        answer: 'Take care! Tap the chat bubble any time you need help.',
    },

    {
        id: 'book_ride',
        keywords: [
            'book', 'booking', 'reserve', 'reservation', 'schedule a ride',
            'order a ride', 'need a ride', 'request a ride', 'how do i book',
        ],
        patterns: [/\b(how\s+(do|to|can)\s+i\s+book|book\s+a\s+ride|request\s+a\s+ride)\b/i],
        answer:
            'To book a ride, tap "Book a Ride Now" on the home screen. Enter pickup and drop-off, choose a time, and confirm.\n\n' +
            '• Rides inside Ashland city limits can be booked same-day or scheduled 24+ hours ahead (lower rate)\n' +
            '• Out-of-town trips must be booked at least 72 hours in advance',
        actions: [
            { label: 'Book now', screen: 'BOOKING' },
            { label: 'Schedule for later', screen: 'BOOKING', params: { scheduledMode: true } },
        ],
    },

    {
        id: 'fares',
        keywords: [
            'fare', 'fares', 'price', 'prices', 'cost', 'how much', 'rate',
            'rates', 'pricing', 'expensive', 'cheap',
        ],
        patterns: [/\b(how\s+much|what\s+does\s+it\s+cost|what'?s\s+the\s+fare)\b/i],
        answer:
            'APT uses transparent flat pricing — no surge, no hidden fees. Rates are set by the City of Ashland.\n\n' +
            '• In-city scheduled (24h+): lowest rate\n' +
            '• In-city same-day: standard rate\n' +
            '• Out-of-town: in-city rate + $2.50/mile (+ $20/hr wait)\n' +
            '• Airport flats: CLE $100 · CAK $100 · CMH $150 (+$10 per extra passenger)\n\n' +
            'Tap below for the full rate card with Elderly/Disabled and child pricing.',
        actions: [
            { label: 'Full fare rates', screen: 'FARE_INFO' },
        ],
    },

    {
        id: 'cancel',
        keywords: [
            'cancel', 'cancellation', 'cancel my ride', 'cancel ride',
            'no-show', 'no show', 'didn\'t show',
        ],
        patterns: [/\b(cancel|no[-\s]?show)\b/i],
        answer:
            'You can cancel any ride from My Rides → select the ride → Cancel.\n\n' +
            '• Free if cancelled before the driver is En-Route\n' +
            '• No-show fee applies if you\'re confirmed but absent: $3 general public, $1.50 elderly/disabled\n' +
            '• Rides not dispatched within 10 minutes of scheduled time auto-cancel with no charge',
        actions: [
            { label: 'Open my rides', screen: 'RIDES' },
        ],
    },

    {
        id: 'pickup_window',
        keywords: [
            'pickup window', 'pick up window', 'pickup time', 'when will driver',
            'driver late', 'driver arrive', 'how long wait',
        ],
        patterns: [/\b(pickup\s+window|when\s+(will|does)\s+(my\s+)?driver|driver\s+arrive)\b/i],
        answer:
            'Ashland Public Transit operates on a 30-minute pickup window. Your driver may arrive anytime within that window, so please be ready at the earliest minute of the window.\n\n' +
            'If 10 minutes pass after the scheduled time with no driver, the ride auto-cancels and you\'ll see it refunded.',
        actions: [
            { label: 'Call dispatch', screen: 'CALL_DISPATCH' },
        ],
    },

    {
        id: 'service_area',
        keywords: [
            'area', 'service area', 'where do you go', 'outside ashland',
            'out of town', 'out-of-town', 'how far', 'radius', 'outside city',
        ],
        patterns: [/\b(service\s+area|how\s+far|outside\s+(of\s+)?ashland|out[\s-]of[\s-]town)\b/i],
        answer:
            'APT serves Ashland and up to a 100-mile radius.\n\n' +
            'Out-of-town rules:\n' +
            '• Must start OR end inside Ashland city limits\n' +
            '• Must be booked at least 72 hours in advance\n' +
            '• In-city base rate + $2.50 per mile + $20/hr wait time if applicable',
        actions: [
            { label: 'Book a trip', screen: 'BOOKING' },
        ],
    },

    {
        id: 'airport',
        keywords: [
            'airport', 'cle', 'cak', 'cmh', 'cleveland', 'akron', 'canton',
            'columbus', 'flight', 'flying',
        ],
        patterns: [/\b(airport|cle|cak|cmh|cleveland|akron|columbus)\b/i],
        answer:
            'Yes — APT runs airport service at flat rates:\n\n' +
            '• Cleveland (CLE): $100\n' +
            '• Akron-Canton (CAK): $100\n' +
            '• Columbus (CMH): $150\n\n' +
            'Each additional passenger is +$10. Please book at least 72 hours ahead.',
        actions: [
            { label: 'Book airport trip', screen: 'BOOKING' },
        ],
    },

    {
        id: 'reduced_fare',
        keywords: [
            'senior', 'seniors', 'elderly', 'disabled', 'ada',
            'reduced fare', 'discount', 'half price', 'child', 'children',
            'kids',
        ],
        patterns: [/\b(senior|elderly|disabled|ada|reduced\s+fare|discount|child(ren)?)\b/i],
        answer:
            'Reduced fares are available for seniors (65+) and ADA-qualifying riders.\n\n' +
            '• Under 12 riding with an adult: FREE\n' +
            '• Under 12 without an adult: child-alone rate\n' +
            '• 2nd rider (companion): half price on the General fare\n\n' +
            'Set your Rider Category in Edit Profile. You may be asked to present proof (driver\'s license or ADA documentation) when boarding.',
        actions: [
            { label: 'Edit profile', screen: 'EDIT_PROFILE' },
            { label: 'Full rate card', screen: 'FARE_INFO' },
        ],
    },

    {
        id: 'accessibility',
        keywords: [
            'wheelchair', 'accessible', 'accessibility', 'mobility',
            'walker', 'cane',
        ],
        patterns: [/\b(wheelchair|accessib|mobility)\b/i],
        answer:
            'Every APT vehicle is wheelchair-accessible. Please note accessibility needs in Edit Profile so dispatch can assign the right vehicle and allow extra boarding time.',
        actions: [
            { label: 'Edit profile', screen: 'EDIT_PROFILE' },
        ],
    },

    {
        id: 'sos',
        keywords: [
            'sos', 'emergency', 'help me', 'urgent', 'unsafe', 'danger', '911',
        ],
        patterns: [/\b(sos|emergency|urgent|unsafe|911)\b/i],
        answer:
            '🆘 If this is a life-threatening emergency, call 911 immediately.\n\n' +
            'For urgent ride assistance, call APT dispatch directly:\n' +
            DISPATCH_PHONE,
        actions: [
            { label: 'Call dispatch', screen: 'CALL_DISPATCH' },
        ],
    },

    {
        id: 'dispatch_contact',
        keywords: [
            'dispatch', 'phone', 'call', 'contact', 'support', 'number',
            'talk to someone', 'human',
        ],
        patterns: [/\b(call|phone|contact|dispatch|support|number)\b/i],
        answer:
            'APT dispatch is reachable at ' + DISPATCH_PHONE + ' during operating hours. For app issues or general questions, tap Help & Support in the menu.',
        actions: [
            { label: 'Call dispatch', screen: 'CALL_DISPATCH' },
            { label: 'Help & Support', screen: 'HELP' },
        ],
    },

    {
        id: 'hours',
        keywords: [
            'hours', 'open', 'closed', 'when do you', 'operating',
            'what time', 'weekend', 'sunday', 'saturday', 'holiday',
        ],
        patterns: [/\b(hours|what\s+time\s+(do|are)\s+you|when\s+(are|do)\s+you\s+(open|run))\b/i],
        answer:
            'APT operates 7 days a week. For the most up-to-date operating hours and holiday schedule, see About Ashland Transit.\n\n' +
            'Dispatch: ' + DISPATCH_PHONE,
        actions: [
            { label: 'About APT', screen: 'ABOUT' },
        ],
    },

    {
        id: 'payment',
        keywords: [
            'payment', 'pay', 'credit card', 'debit', 'card', 'stripe',
            'apple pay', 'google pay', 'cash',
        ],
        patterns: [/\b(payment|pay\s+(with|by)|credit\s+card|stripe)\b/i],
        answer:
            'APT accepts all major credit and debit cards through secure Stripe checkout in-app. You can save a card for faster booking in Payment Methods.',
        actions: [
            { label: 'Payment methods', screen: 'PAYMENT_METHODS' },
        ],
    },

    {
        id: 'track',
        keywords: [
            'track', 'where is my driver', 'where is the driver', 'eta',
            'where is my ride', 'status',
        ],
        patterns: [/\b(track|where\s+is\s+my|eta|status\s+of)\b/i],
        answer:
            'You can live-track any active ride from My Rides — tap the ride and then "View Ticket" to see the driver\'s location and ETA.',
        actions: [
            { label: 'My rides', screen: 'RIDES' },
        ],
    },

    {
        id: 'account',
        keywords: [
            'account', 'profile', 'password', 'login', 'sign in', 'sign up',
            'email', 'change email', 'change password',
        ],
        patterns: [/\b(account|profile|password|sign\s+(in|up)|log\s+in)\b/i],
        answer:
            'Manage your account from the Profile menu:\n\n' +
            '• Edit Profile — name, email, phone, DOB, rider category\n' +
            '• Change Password — update your login\n' +
            '• Saved Places — home, work, and favorites for faster booking',
        actions: [
            { label: 'Profile', screen: 'PROFILE' },
            { label: 'Change password', screen: 'CHANGE_PASSWORD' },
        ],
    },

    {
        id: 'theme',
        keywords: [
            'dark mode', 'light mode', 'theme', 'appearance', 'night mode',
        ],
        patterns: [/\b(dark\s+mode|light\s+mode|theme|appearance)\b/i],
        answer:
            'You can switch between Light, Dark, and System themes in Settings → Appearance.',
        actions: [
            { label: 'Open settings', screen: 'SETTINGS' },
        ],
    },
];

/**
 * Fallback response when no intent scores high enough.
 * Offers the most common paths so the user is never stuck.
 */
export const FALLBACK = {
    id: 'fallback',
    answer:
        "I'm not sure I caught that. I can help with fares, booking, cancellations, the pickup window, airport trips, accessibility, and dispatch contact.\n\n" +
        "Try rephrasing, or pick an option below:",
    actions: [
        { label: 'Fares', screen: 'FARE_INFO' },
        { label: 'Book a ride', screen: 'BOOKING' },
        { label: 'My rides', screen: 'RIDES' },
        { label: 'Help & Support', screen: 'HELP' },
    ],
};

/**
 * Shown as tappable suggestions on the empty-state / first message.
 */
export const STARTER_PROMPTS = [
    'How do I book a ride?',
    'How much does it cost?',
    'What is the pickup window?',
    'Do you go to the airport?',
    'Can I cancel my ride?',
    'Is APT wheelchair accessible?',
];
