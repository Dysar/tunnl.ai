// Known URL categories for fast category detection
// This file contains a mapping of hostnames to their categories

// Define in global scope for importScripts
var KNOWN_URL_CATEGORIES = {

    // Social Media
    'facebook.com': 'social-media',
    'm.facebook.com': 'social-media',
    'twitter.com': 'social-media',
    'x.com': 'social-media',
    'instagram.com': 'social-media',
    'tiktok.com': 'social-media',
    'linkedin.com': 'social-media',
    'snapchat.com': 'social-media',
    'reddit.com': 'social-media',
    'discord.com': 'social-media',
    'discord.gg': 'social-media',
    'telegram.org': 'social-media',
    'whatsapp.com': 'social-media',
    'youtube.com': 'social-media',
    'm.youtube.com': 'social-media',
    'twitch.tv': 'social-media',
    'pinterest.com': 'social-media',
    'tumblr.com': 'social-media',
    'flickr.com': 'social-media',

    // News
    'cnn.com': 'news',
    'bbc.com': 'news',
    'bbc.co.uk': 'news',
    'nytimes.com': 'news',
    'washingtonpost.com': 'news',
    'theguardian.com': 'news',
    'reuters.com': 'news',
    'bloomberg.com': 'news',
    'wsj.com': 'news',
    'forbes.com': 'news',
    'huffpost.com': 'news',
    'buzzfeed.com': 'news',
    'vice.com': 'news',
    'vox.com': 'news',
    'theatlantic.com': 'news',
    'newyorker.com': 'news',

    // Gaming
    'steam.com': 'gaming',
    'store.steampowered.com': 'gaming',
    'steamcommunity.com': 'gaming',
    'epicgames.com': 'gaming',
    'store.epicgames.com': 'gaming',
    'origin.com': 'gaming',
    'uplay.com': 'gaming',
    'battle.net': 'gaming',
    'roblox.com': 'gaming',
    'minecraft.net': 'gaming',
    'leagueoflegends.com': 'gaming',
    'dota2.com': 'gaming',
    'playvalorant.com': 'gaming',
    'playoverwatch.com': 'gaming',
    'worldofwarcraft.com': 'gaming',

    // Music
    'spotify.com': 'music',
    'open.spotify.com': 'music',
    'music.apple.com': 'music',
    'soundcloud.com': 'music',
    'pandora.com': 'music',
    'last.fm': 'music',
    'bandcamp.com': 'music',
    'tidal.com': 'music',
    'deezer.com': 'music',

    // Shopping
    'amazon.com': 'shopping',
    'amazon.co.uk': 'shopping',
    'amazon.de': 'shopping',
    'amazon.fr': 'shopping',
    'ebay.com': 'shopping',
    'etsy.com': 'shopping',
    'walmart.com': 'shopping',
    'target.com': 'shopping',
    'bestbuy.com': 'shopping',
    'newegg.com': 'shopping',
    'aliexpress.com': 'shopping',
    'wish.com': 'shopping',
    'overstock.com': 'shopping',

    // Travel
    'booking.com': 'travel',
    'expedia.com': 'travel',
    'hotels.com': 'travel',
    'airbnb.com': 'travel',
    'vrbo.com': 'travel',
    'tripadvisor.com': 'travel',
    'kayak.com': 'travel',
    'priceline.com': 'travel',
    'orbitz.com': 'travel',
    'travelocity.com': 'travel',

    // Gambling
    'bet365.com': 'gambling',
    'pokerstars.com': 'gambling',
    '888.com': 'gambling',
    'unibet.com': 'gambling',
    'williamhill.com': 'gambling',
    'ladbrokes.com': 'gambling',
    'paddypower.com': 'gambling',

    // NSFW (limited examples for safety)
    'pornhub.com': 'nsfw',
    'xvideos.com': 'nsfw',
    'redtube.com': 'nsfw',
    'youporn.com': 'nsfw',
    'xhamster.com': 'nsfw',
    'onlyfans.com': 'nsfw',
    'chaturbate.com': 'nsfw',
    'livejasmin.com': 'nsfw',

};

// Category descriptions for LLM analysis
var CATEGORY_DESCRIPTIONS = {
    'gambling': {
        name: 'Gambling',
        description: 'Online gambling, betting, and casino websites including sports betting, poker, casino games, lottery, bingo, slots, roulette, blackjack, and other games of chance where money can be won or lost. This includes both legal and illegal gambling sites, betting exchanges, and gambling-related forums or communities.'
    },
    'nsfw': {
        name: 'Adult Content',
        description: 'Adult content, pornography, explicit material, and sexually explicit websites including adult videos, images, live cams, dating sites focused on casual encounters, fetish content, BDSM material, and other adult-oriented content that may not be appropriate for all audiences.'
    },
    'social-media': {
        name: 'Social Media',
        description: 'Social networking platforms, social media sites, and community platforms where users can share content, connect with others, post updates, photos, videos, and engage in social interactions. This includes platforms like Facebook, Twitter, Instagram, TikTok, LinkedIn, Snapchat, Reddit, Discord, and similar social networking services.'
    },
    'news': {
        name: 'News & Media',
        description: 'News websites, current events, journalism, political news, celebrity news, and media outlets that provide information about recent events, politics, entertainment, sports news, and other current affairs. This includes both traditional news sources and digital media platforms that focus on news reporting and commentary.'
    },
    'gaming': {
        name: 'Gaming',
        description: 'Gaming websites, game stores, gaming platforms, gaming forums, and gaming-related content including video game distribution platforms, gaming communities, game streaming services, gaming news, reviews, and platforms where users can play, purchase, or discuss video games and gaming culture.'
    },
    'music': {
        name: 'Music & Entertainment',
        description: 'Music streaming services, music videos, music news, concert tickets, music discovery platforms, and entertainment content focused on music, artists, albums, songs, concerts, festivals, and music-related entertainment. This includes both streaming platforms and music-focused social networks.'
    },
    'shopping': {
        name: 'Shopping & E-commerce',
        description: 'E-commerce sites, online stores, deal sites, auction sites, and shopping platforms where users can browse, compare, and purchase products or services. This includes online marketplaces, retail websites, deal aggregators, coupon sites, and platforms focused on commercial transactions and shopping experiences.'
    },
    'travel': {
        name: 'Travel & Tourism',
        description: 'Travel booking websites, vacation planning platforms, hotel booking sites, flight booking services, travel guides, and tourism-related content including travel deals, destination information, accommodation booking, transportation booking, and travel planning tools and resources.'
    }
};