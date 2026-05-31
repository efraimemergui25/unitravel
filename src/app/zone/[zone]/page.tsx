'use client';

import { useParams }              from 'next/navigation';
import { OmniSelectorConsole }    from '@/components/OmniSelectorConsole';
import { ZoneResultsArea }        from '@/components/ZoneResultsArea';
import { FlightZone }             from '@/components/FlightZone';
import { LodgingZone }            from '@/components/LodgingZone';
import { DiningZone }             from '@/components/DiningZone';
import { AttractionsZone }        from '@/components/AttractionsZone';
import { TransitZone }            from '@/components/TransitZone';
import { ZONE_META, ZoneId }      from '@/lib/zoneEngines';

const VALID_ZONES: ZoneId[] = ['flights', 'lodging', 'dining', 'attractions', 'transit'];

export default function ZonePage() {
  const { zone } = useParams<{ zone: string }>();
  const zoneId   = VALID_ZONES.includes(zone as ZoneId) ? (zone as ZoneId) : 'flights';
  const meta     = ZONE_META[zoneId];

  return (
    <div
      style={{
        display:   'flex',
        width:     '100%',
        height:    '100%',
        overflow:  'hidden',
        background: `radial-gradient(ellipse at 0% 0%, ${meta.color}07 0%, transparent 60%),
                     radial-gradient(ellipse at 100% 100%, ${meta.color}05 0%, transparent 50%),
                     #F2F2F7`,
      }}
    >
      {/* Left: Engine Control Console */}
      <OmniSelectorConsole zone={zoneId} />

      {/* Right: Results area (zone-specific) */}
      {zoneId === 'flights'     ? <FlightZone />      :
       zoneId === 'lodging'     ? <LodgingZone />     :
       zoneId === 'dining'      ? <DiningZone />      :
       zoneId === 'attractions' ? <AttractionsZone /> :
       zoneId === 'transit'     ? <TransitZone />     :
       <ZoneResultsArea zone={zoneId} />
      }
    </div>
  );
}
