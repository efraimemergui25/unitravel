import type { BentoHotel } from '@/app/api/hotels/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformAmadeusHotelOffer(offer: any): BentoHotel[] {
  const hotel  = offer.hotel  ?? {};
  const offers = offer.offers ?? [];
  if (offers.length === 0) return [];

  const first  = offers[0]      ?? {};
  const price  = first.price    ?? {};
  const room   = first.room     ?? {};
  const board  = first.boardType ?? 'ROOM_ONLY';

  const checkIn  = first.checkInDate  ?? '';
  const checkOut = first.checkOutDate ?? '';
  const nights   = checkIn && checkOut
    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
    : 1;
  const total    = Math.round(parseFloat(price.total ?? '0'));
  const perNight = nights > 0 ? Math.round(total / nights) : total;

  const amenities: string[] = (hotel.amenities ?? []).slice(0, 6).map((a: string) =>
    a.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
  );

  const boardLabel: Record<string, string> = {
    ROOM_ONLY: 'Room only', BREAKFAST: 'Breakfast included',
    HALF_BOARD: 'Half board', FULL_BOARD: 'Full board', ALL_INCLUSIVE: 'All inclusive',
  };

  return [{
    id:            offers[0]?.id ?? hotel.hotelId,
    name:          hotel.name ?? 'Hotel',
    chainCode:     hotel.chainCode,
    cityCode:      hotel.cityCode ?? '',
    latitude:      hotel.latitude,
    longitude:     hotel.longitude,
    rating:        hotel.rating ? parseInt(hotel.rating) : undefined,
    amenities,
    pricePerNight: perNight,
    totalPrice:    total,
    currency:      price.currency ?? 'USD',
    checkIn,
    checkOut,
    nights,
    roomType:      room.typeEstimated?.category ?? room.type ?? 'Standard Room',
    boardType:     boardLabel[board] ?? board,
    available:     true,
    bookingUrl:    `https://www.google.com/travel/hotels?q=${encodeURIComponent(hotel.name ?? '')}`,
    source:        'Amadeus',
    offerId:       offers[0]?.id ?? hotel.hotelId,
  }];
}
