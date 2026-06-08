import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Booking.com — hotel images
      { protocol: 'https', hostname: '**.booking.com' },
      { protocol: 'https', hostname: 'cf.bstatic.com' },
      { protocol: 'https', hostname: 't-cf.bstatic.com' },
      // Yelp — restaurant photos
      { protocol: 'https', hostname: '**.yelpcdn.com' },
      { protocol: 'https', hostname: 's3-media*.fl.yelpcdn.com' },
      // Skyscanner — airline/flight imagery
      { protocol: 'https', hostname: '**.skyscanner.net' },
      { protocol: 'https', hostname: 'logos.skyscnr.com' },
      // Google — user avatars + Places photos
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh1.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh2.googleusercontent.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      // Amadeus — hotel chain logos
      { protocol: 'https', hostname: '**.amadeus.com' },
      // Expedia / Hotels.com
      { protocol: 'https', hostname: '**.expedia.com' },
      { protocol: 'https', hostname: '**.hotels.com' },
      { protocol: 'https', hostname: 'images.trvl-media.com' },
      // TripAdvisor — attraction & dining photos
      { protocol: 'https', hostname: 'media-cdn.tripadvisor.com' },
      { protocol: 'https', hostname: '**.tripadvisor.com' },
      // Airbnb
      { protocol: 'https', hostname: 'a0.muscache.com' },
      // GetYourGuide + Viator — attraction images
      { protocol: 'https', hostname: 'cdn.getyourguide.com' },
      { protocol: 'https', hostname: '**.viatorcdn.com' },
      // Airline logos (AirHex CDN)
      { protocol: 'https', hostname: 'content.airhex.com' },
      { protocol: 'https', hostname: 'pics.avs.io' },
      // Unsplash — destination hero images
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
