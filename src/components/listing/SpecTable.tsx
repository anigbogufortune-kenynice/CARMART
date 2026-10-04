import { formatNaira } from '@/lib/format'
import { BODY_TYPE_LABELS, CONDITION_LABELS, FUEL_LABELS, TRANSMISSION_LABELS, stateLabel, type NgState } from '@/types/domain'

export type SpecCar = {
  price_cents: number | null; year: number | null; odometer_km: number | null; condition: string | null
  body_type: string | null; transmission: string | null; fuel: string | null; colour: string | null
  vin: string | null; city: string | null; state: NgState | null
}

const label = <T extends string>(labels: Record<T, string>, v: string | null) => (v && v in labels ? labels[v as T] : v)

/** The car's specs as a two-column table; the VIN comes with a reminder to check its history (ADR-015). */
export function SpecTable({ car }: { car: SpecCar }) {
  const rows: [string, string | null][] = [
    ['Price', car.price_cents != null ? formatNaira(car.price_cents) : null],
    ['Year', car.year != null ? String(car.year) : null],
    ['Kilometres', car.odometer_km != null ? `${car.odometer_km.toLocaleString('en-NG')} km` : null],
    ['Condition', label(CONDITION_LABELS, car.condition)],
    ['Body type', label(BODY_TYPE_LABELS, car.body_type)],
    ['Transmission', label(TRANSMISSION_LABELS, car.transmission)],
    ['Fuel', label(FUEL_LABELS, car.fuel)],
    ['Colour', car.colour],
    ['Location', [car.city, car.state ? stateLabel(car.state) : null].filter(Boolean).join(', ') || null],
  ]
  return (
    <div>
      <table className="w-full text-[15px]">
        <tbody>
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <tr key={k} className="border-b border-[#E2E7EF] last:border-0">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal text-[#5A6578]">{k}</th>
              <td className="py-2.5 text-right font-medium text-[#1B2333]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {car.vin && (
        <div className="mt-4 rounded-lg bg-[#F6F8FB] px-4 py-3">
          <p className="text-[13px] text-[#5A6578]">VIN</p>
          <code className="mt-0.5 block break-all font-mono text-[15px] tracking-wider text-[#1B2333]">{car.vin}</code>
          <p className="mt-2 text-[13px] text-[#5A6578]">
            Before you pay, check this VIN’s history (for an imported car, a Carfax or similar report) and make sure it matches the car’s papers.
          </p>
        </div>
      )}
    </div>
  )
}
