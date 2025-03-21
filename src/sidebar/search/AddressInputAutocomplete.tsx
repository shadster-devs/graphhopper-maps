import styles from './AddressInputAutocomplete.module.css'
import { Bbox } from '@/api/graphhopper'
import { AddressParseResult } from '@/pois/AddressParseResult'
import { SarathiLocation } from '@/stores/QueryStore'
import { FaLocationDot } from 'react-icons/fa6'

export interface AutocompleteItem {}

export class GeocodingItem implements AutocompleteItem {
    mainText: string
    secondText: string
    point: { lat: number; lng: number }
    bbox: Bbox
    sarathiLocation?: SarathiLocation

    constructor(
        mainText: string, 
        secondText: string, 
        point: { lat: number; lng: number }, 
        bbox: Bbox,
        sarathiLocation?: SarathiLocation
    ) {
        this.mainText = mainText
        this.secondText = secondText
        this.point = point
        this.bbox = bbox
        this.sarathiLocation = sarathiLocation
    }

    toText() {
        if (!this.secondText) {
            return this.mainText;
        }
        
        if (this.mainText.includes(this.secondText)) {
            return this.mainText;
        }
        
        return this.mainText + ', ' + this.secondText;
    }
}

export class POIQueryItem implements AutocompleteItem {
    result: AddressParseResult

    constructor(result: AddressParseResult) {
        this.result = result
    }
}

export interface AutocompleteProps {
    items: AutocompleteItem[]
    highlightedItem: AutocompleteItem
    onSelect: (hit: AutocompleteItem) => void
}

export default function Autocomplete({ items, highlightedItem, onSelect }: AutocompleteProps) {
    return (
        <ul>
            {items.map((item, i) => (
                <li key={i} className={styles.autocompleteItem}>
                    {mapToComponent(item, highlightedItem === item, onSelect)}
                </li>
            ))}
        </ul>
    )
}

function mapToComponent(item: AutocompleteItem, isHighlighted: boolean, onSelect: (hit: AutocompleteItem) => void) {
    if (item instanceof GeocodingItem)
        return <GeocodingEntry item={item} isHighlighted={isHighlighted} onSelect={onSelect} />
    else if (item instanceof POIQueryItem)
        return <POIQueryEntry item={item} isHighlighted={isHighlighted} onSelect={onSelect} />
    else throw Error('Unsupported item type: ' + typeof item)
}

export function POIQueryEntry({
    item,
    isHighlighted,
    onSelect,
}: {
    item: POIQueryItem
    isHighlighted: boolean
    onSelect: (item: POIQueryItem) => void
}) {
    const poi = item.result.poi ? item.result.poi : ''
    return (
        <AutocompleteEntry isHighlighted={isHighlighted} onSelect={() => onSelect(item)}>
            <div className={styles.poiEntry}>
                <span className={styles.locationIcon}>
                    <FaLocationDot color="#5b616a" />
                </span>
                <div className={styles.poiContent}>
                    <span className={styles.poiEntryPrimaryText}>{poi.charAt(0).toUpperCase() + poi.slice(1)}</span>
                    <span>{item.result.text('')}</span>
                </div>
            </div>
        </AutocompleteEntry>
    )
}

function GeocodingEntry({
    item,
    isHighlighted,
    onSelect,
}: {
    item: GeocodingItem
    isHighlighted: boolean
    onSelect: (item: GeocodingItem) => void
}) {
    return (
        <AutocompleteEntry isHighlighted={isHighlighted} onSelect={() => onSelect(item)}>
            <div className={styles.geocodingEntry} title={item.toText()}>
                <div className={styles.geocodingEntryContent}>
                    <span className={styles.locationIcon}>
                        <FaLocationDot color="#5b616a" />
                    </span>
                    <div className={styles.textContent}>
                        <span className={styles.mainText}>{item.mainText}</span>
                        {/* Only show secondaryText if it adds meaningful information */}
                        {item.secondText && !item.mainText.includes(item.secondText) && (
                            <span className={styles.secondaryText}>{item.secondText}</span>
                        )}
                    </div>
                </div>
            </div>
        </AutocompleteEntry>
    )
}

function AutocompleteEntry({
    isHighlighted,
    children,
    onSelect,
}: {
    isHighlighted: boolean
    children: React.ReactNode
    onSelect: () => void
}) {
    const className = isHighlighted ? styles.selectableItem + ' ' + styles.highlightedItem : styles.selectableItem
    return (
        <button
            className={className}
            // using click events for mouse interaction and touch end to select an entry.
            onClick={() => onSelect()}
            // minor workaround to improve success rate for click even if start and end location on screen are slightly different
            onTouchEnd={e => {
                e.preventDefault() // do not forward click to underlying component
                onSelect()
            }}
            onMouseDown={e => {
                // prevents that input->onBlur is called when clicking the autocomplete item (focus would be lost and autocomplete items would disappear before they can be clicked)
                // See also the onMouseDown calls in the buttons in AddressInput.tsx created for the same reason.
                e.preventDefault()
            }}
        >
            {children}
        </button>
    )
}
