import { KSA_MAP_VIEWBOX, ksaRegionPaths } from '../data/ksaMapPaths';
import type { RegionCode } from '../data/workshops';
import { focusRegionCodes, regionColors, regionNameByCode } from '../data/workshops';

type Props = {
  values: Partial<Record<RegionCode, number>>;
  maxValue: number;
  selectedRegion: RegionCode | null;
  onSelect: (region: RegionCode) => void;
};

const FOCUS_SET = new Set<RegionCode>(focusRegionCodes);
const NON_FOCUS_FILL = '#5b6472';

export default function KsaMap({ values, maxValue, selectedRegion, onSelect }: Props) {
  const regions = Object.keys(ksaRegionPaths) as RegionCode[];

  return (
    <svg viewBox={KSA_MAP_VIEWBOX} className="w-full max-w-[300px]" role="group" aria-label="خريطة المملكة حسب المنطقة">
      {regions.map((region) => {
        if (!FOCUS_SET.has(region)) {
          // Outside the program's current 4 focus regions: an inert gray/blurred silhouette —
          // no data, not clickable, no tooltip.
          return (
            <path
              key={region}
              d={ksaRegionPaths[region]}
              fill={NON_FOCUS_FILL}
              opacity={0.28}
              stroke="rgba(6,19,28,0.6)"
              strokeWidth={0.6}
              style={{ filter: 'blur(1.1px)', pointerEvents: 'none' }}
              aria-hidden="true"
            />
          );
        }

        const value = values[region] ?? 0;
        // A fixed, distinct hue per region (the same one used in the region list/legend to its
        // left) rather than one shared hue shaded by value — value is still conveyed, but via
        // opacity, so each region stays visually identifiable on its own.
        const intensity = maxValue > 0 ? value / maxValue : 0;
        const isSelected = selectedRegion === region;
        const isDimmed = selectedRegion !== null && !isSelected;
        const color = regionColors[region];
        const valueOpacity = 0.4 + intensity * 0.6;
        return (
          <path
            key={region}
            d={ksaRegionPaths[region]}
            fill={color}
            opacity={isDimmed ? 0.25 : valueOpacity}
            stroke={isSelected ? color : 'rgba(6,19,28,0.6)'}
            strokeWidth={isSelected ? 2 : 0.6}
            className="cursor-pointer transition-all duration-200 hover:brightness-110"
            onClick={() => onSelect(region)}
          >
            <title>
              {regionNameByCode[region]} — {value.toLocaleString('en-US')}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
