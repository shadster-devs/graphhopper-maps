import { Path, RoutingResultInfo } from '@/api/graphhopper'
import { SegmentedPath } from '@/api/sarathi'
import { Coordinate, CurrentRequest, getBBoxFromCoord, RequestState, SubRequest } from '@/stores/QueryStore'
import styles from './RoutingResult.module.css'
import { ReactNode, useContext, useEffect, useState } from 'react'
import Dispatcher from '@/stores/Dispatcher'
import { PathDetailsElevationSelected, SetBBox, SetSelectedPath } from '@/actions/Actions'
import { metersToShortText, metersToTextForFile, milliSecondsToText } from '@/Converters'
import PlainButton from '@/PlainButton'
import Details from '@/sidebar/list.svg'
import GPXDownload from '@/sidebar/file_download.svg'
import { LineString, Position } from 'geojson'
import { calcDist } from '@/distUtils'
import { useMediaQuery } from 'react-responsive'
import { tr } from '@/translation/Translation'
import { Bbox } from '@/api/graphhopper'
import { SettingsContext } from '@/contexts/SettingsContext'
import { Settings } from '@/stores/SettingsStore'

export interface RoutingResultsProps {
    paths: SegmentedPath[]
    selectedPath: SegmentedPath
    currentRequest: CurrentRequest
    profile: string
}

export default function RoutingResults(props: RoutingResultsProps) {
    // for landscape orientation there is no need that there is space for the map under the 3 alternatives and so the max-height is smaller for short screen
    const isShortScreen = useMediaQuery({
        query: '(max-height: 45rem) and (orientation: landscape), (max-height: 70rem) and (orientation: portrait)',
    })
    return <ul>{isShortScreen ? createSingletonListContent(props) : createListContent(props)}</ul>
}

function RoutingResult({
    path,
    isSelected,
    profile,
}: {
    path: SegmentedPath
    isSelected: boolean
    profile: string
}) {
    const [isExpanded, setExpanded] = useState(false)
    const resultSummaryClass = isSelected
        ? styles.resultSummary + ' ' + styles.selectedResultSummary
        : styles.resultSummary

    useEffect(() => setExpanded(isSelected && isExpanded), [isSelected])
    const settings = useContext(SettingsContext)
    const showDistanceInMiles = settings.showDistanceInMiles

    // Get all unique transport modes used in this path
    const transportModes = path.segments ? [...new Set(path.segments.map(segment => segment.mode))] : [];
    
    // Create a summary of transport modes
    const transportModeSummary = transportModes.join(' → ');

    return (
        <div className={styles.resultRow}>
            <div className={styles.resultSelectableArea} onClick={() => Dispatcher.dispatch(new SetSelectedPath(path))}>
                <div className={resultSummaryClass}>
                    <div className={styles.resultValues}>
                        <span className={styles.resultMainText}>{milliSecondsToText(path.time)}</span>
                        <span className={styles.resultSecondaryText}>
                            {metersToShortText(path.distance, showDistanceInMiles)}
                        </span>
                        {/* {isSelected && !ApiImpl.isMotorVehicle(profile) && (
                            <div className={styles.elevationHint}>
                                <span title={tr('total_ascend', [Math.round(path.ascend) + 'm'])}>
                                    ↗{metersToShortText(path.ascend, showDistanceInMiles)}{' '}
                                </span>
                                <span title={tr('total_descend', [Math.round(path.descend) + 'm'])}>
                                    ↘{metersToShortText(path.descend, showDistanceInMiles)}
                                </span>
                            </div>
                        )} */}
                    
                    </div>
                </div>
            </div>
            {/* {isSelected && !isExpanded && showHints && (
                <div className={styles.routeHints}>
                    <div className={styles.icons}>
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains_ford')}
                            setType={t => setSelectedRH(t)}
                            type={'ford'}
                            child={<FordIcon />}
                            value={fordInfo.distance > 0 && metersToShortText(fordInfo.distance, showDistanceInMiles)}
                            selected={selectedRH}
                            segments={fordInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_crosses_border')}
                            setType={t => setSelectedRH(t)}
                            type={'border'}
                            child={<BorderCrossingIcon />}
                            value={borderInfo.values.length > 0 && borderInfo.values[0]}
                            selected={selectedRH}
                            segments={borderInfo.segments}
                            values={borderInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains_ferry')}
                            setType={t => setSelectedRH(t)}
                            type={'ferry'}
                            child={<FerryIcon />}
                            value={ferryInfo.distance > 0 && metersToShortText(ferryInfo.distance, showDistanceInMiles)}
                            selected={selectedRH}
                            segments={ferryInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains_restrictions')}
                            setType={t => setSelectedRH(t)}
                            type={'access_conditional'}
                            child={<CondAccessIcon />}
                            value={
                                accessCondInfo.distance > 0 &&
                                metersToShortText(accessCondInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={accessCondInfo.segments}
                            values={accessCondInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains_restrictions')}
                            setType={t => setSelectedRH(t)}
                            type={'foot_access_conditional'}
                            child={<CondAccessIcon />}
                            value={
                                footAccessCondInfo.distance > 0 &&
                                metersToShortText(footAccessCondInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={footAccessCondInfo.segments}
                            values={footAccessCondInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains_restrictions')}
                            setType={t => setSelectedRH(t)}
                            type={'bike_access_conditional'}
                            child={<CondAccessIcon />}
                            value={
                                bikeAccessCondInfo.distance > 0 &&
                                metersToShortText(bikeAccessCondInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={bikeAccessCondInfo.segments}
                            values={bikeAccessCondInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains', [tr('private_sections')])}
                            setType={t => setSelectedRH(t)}
                            type={'private'}
                            child={<PrivateIcon />}
                            value={
                                privateOrDeliveryInfo.distance > 0 &&
                                metersToShortText(privateOrDeliveryInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={privateOrDeliveryInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains_toll')}
                            setType={t => setSelectedRH(t)}
                            type={'toll'}
                            child={showDistanceInMiles ? <DollarIcon /> : <EuroIcon />}
                            value={tollInfo.distance > 0 && metersToShortText(tollInfo.distance, showDistanceInMiles)}
                            selected={selectedRH}
                            segments={tollInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains', [tr('challenging_sections')])}
                            setType={t => setSelectedRH(t)}
                            type={'mtb_rating'}
                            child={<DangerousIcon />}
                            value={
                                mtbRatingInfo.distance > 0 &&
                                metersToShortText(mtbRatingInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={mtbRatingInfo.segments}
                            values={mtbRatingInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains', [tr('challenging_sections')])}
                            setType={t => setSelectedRH(t)}
                            type={'hike_rating'}
                            child={<DangerousIcon />}
                            value={
                                hikeRatingInfo.distance > 0 &&
                                metersToShortText(hikeRatingInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={hikeRatingInfo.segments}
                            values={hikeRatingInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains', [tr('steps')])}
                            setType={t => setSelectedRH(t)}
                            type={'steps'}
                            child={<StepsIcon />}
                            value={stepsInfo.distance > 0 && metersToShortText(stepsInfo.distance, showDistanceInMiles)}
                            selected={selectedRH}
                            segments={stepsInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains', [tr('tracks')])}
                            setType={t => setSelectedRH(t)}
                            type={'tracks'}
                            child={<BadTrackIcon />}
                            value={
                                badTrackInfo.distance > 0 &&
                                metersToShortText(badTrackInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={badTrackInfo.segments}
                            values={badTrackInfo.values}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('trunk_roads_warn')}
                            setType={t => setSelectedRH(t)}
                            type={'trunk'}
                            child={<DangerousIcon />}
                            value={trunkInfo.distance > 0 && metersToShortText(trunkInfo.distance, showDistanceInMiles)}
                            selected={selectedRH}
                            segments={trunkInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('get_off_bike_for', [
                                metersToShortText(getOffBikeInfo.distance, showDistanceInMiles),
                            ])}
                            setType={t => setSelectedRH(t)}
                            type={'get_off_bike'}
                            child={<GetOffBikeIcon />}
                            value={
                                getOffBikeInfo.distance > 0 &&
                                metersToShortText(getOffBikeInfo.distance, showDistanceInMiles)
                            }
                            selected={selectedRH}
                            segments={getOffBikeInfo.segments}
                            values={[]}
                        />
                        <RHButton
                            setDescription={b => setDescriptionRH(b)}
                            description={tr('way_contains', [tr('steep_sections')])}
                            setType={t => setSelectedRH(t)}
                            type={'steep_sections'}
                            child={<SteepIcon />}
                            value={steepInfo.distance > 0 && metersToShortText(steepInfo.distance, showDistanceInMiles)}
                            selected={selectedRH}
                            segments={steepInfo.segments}
                            values={steepInfo.values}
                        />
                    </div>
                    {descriptionRH && <div>{descriptionRH}</div>}
                </div>
            )} */}
            {/* {isExpanded && <Instructions instructions={path.instructions} us={showDistanceInMiles} />} */}
            {/* {isExpanded && (
                <div className={styles.routingResultRoadData}>
                    {tr('road_data_from')}: {info.road_data_timestamp}
                </div>
            )} */}
        </div>
    )
}

function RHButton(p: {
    setDescription: (s: string) => void
    description: string
    setType: (s: string) => void
    type: string
    child: ReactNode
    value: string | false
    selected: string
    segments: Coordinate[][]
    values: string[]
}) {
    let [index, setIndex] = useState(0)
    if (p.value === false) return null
    return (
        <PlainButton
            className={p.selected == p.type ? styles.selectedRouteHintButton : styles.routeHintButton}
            onClick={() => {
                p.setType(p.type)

                if (index < 0) {
                    Dispatcher.dispatch(new PathDetailsElevationSelected([]))
                    p.setDescription('')
                } else {
                    let tmpDescription
                    if (p.type == 'get_off_bike') tmpDescription = p.description
                    else if (p.type == 'border') tmpDescription = p.description + ': ' + p.values[index]
                    else if (p.values && p.values[index]) {
                        if (p.type.includes('rating'))
                            tmpDescription =
                                p.description + ': ' + p.value + ' (' + p.type + ':' + p.values[index] + ')'
                        else if (p.type.includes('steep')) tmpDescription = p.description + ': ' + p.values[index]
                        else tmpDescription = p.description + ': ' + p.value + ' ' + p.values[index]
                    } else tmpDescription = p.description + ': ' + p.value

                    p.setDescription(tmpDescription)
                    Dispatcher.dispatch(new PathDetailsElevationSelected(p.segments))
                    if (p.segments.length > index) Dispatcher.dispatch(new SetBBox(toBBox(p.segments[index])))
                }

                setIndex(index + 1 >= p.segments.length ? -1 : index + 1)
            }}
            title={p.description}
        >
            {p.child}
            {<span>{p.value}</span>}
        </PlainButton>
    )
}

function crossesBorderInfo(points: LineString, countryPathDetail: [number, number, string][]) {
    if (!countryPathDetail || countryPathDetail.length == 0) return new RouteInfo()
    const info = new RouteInfo()
    let prev = countryPathDetail[0][2]
    const coords = points.coordinates
    for (const i in countryPathDetail) {
        if (countryPathDetail[i][2] != prev) {
            info.values.push(prev + ' - ' + countryPathDetail[i][2])
            info.segments.push([
                toCoordinate(coords[countryPathDetail[i][0] - 1]),
                toCoordinate(coords[countryPathDetail[i][0]]),
            ])
            prev = countryPathDetail[i][2]
        }
    }
    return info
}

class RouteInfo {
    segments: Coordinate[][] = []
    distance: number = 0
    values: string[] = []
}

function toCoordinate(pos: Position): Coordinate {
    return { lng: pos[0], lat: pos[1] }
}

function toBBox(segment: Coordinate[]): Bbox {
    // TODO replace with ApiImpl.getBBoxPoints
    const bbox = getBBoxFromCoord(segment[0], 0.002)
    if (segment.length == 1) bbox
    segment.forEach(c => {
        bbox[0] = Math.min(bbox[0], c.lng)
        bbox[1] = Math.min(bbox[1], c.lat)
        bbox[2] = Math.max(bbox[2], c.lng)
        bbox[3] = Math.max(bbox[3], c.lat)
    })
    if (bbox[2] - bbox[0] < 0.005) {
        bbox[0] -= 0.005 / 2
        bbox[2] += 0.005 / 2
    }
    if (bbox[3] - bbox[1] < 0.005) {
        bbox[1] -= 0.005 / 2
        bbox[3] += 0.005 / 2
    }
    return bbox as Bbox
}

function getInfoFor(points: LineString, details: [number, number, any][], fnc: { (s: any): boolean }) {
    if (!details) return new RouteInfo()
    let info = new RouteInfo()
    const coords = points.coordinates
    for (const i in details) {
        if (fnc(details[i][2])) {
            const from = details[i][0],
                to = details[i][1]
            const segCoords: Coordinate[] = []
            for (let i = from; i < to; i++) {
                const dist = calcDistPos(coords[i], coords[i + 1])
                info.distance += dist
                if (dist == 0) info.distance += 0.01 // some obstacles have no length when mapped as a node like fords
                segCoords.push(toCoordinate(coords[i]))
            }
            segCoords.push(toCoordinate(coords[to]))
            info.values.push(details[i][2])
            info.segments.push(segCoords)
        }
    }
    return info
}

function calcDistPos(from: Position, to: Position): number {
    return calcDist({ lat: from[1], lng: from[0] }, { lat: to[1], lng: to[0] })
}

// sums up the lengths of the road segments with a slope bigger than steepSlope
function getHighSlopeInfo(points: LineString, steepSlope: number, showDistanceInMiles: boolean) {
    if (points.coordinates.length == 0) return new RouteInfo()
    if (points.coordinates[0].length != 3) return new RouteInfo()
    const info = new RouteInfo()
    let distForSlope = 0
    let segmentPoints: Coordinate[] = []
    let prevElePoint = points.coordinates[0]
    let prevDistPoint = points.coordinates[0]
    points.coordinates.forEach(currPoint => {
        distForSlope += calcDistPos(currPoint, prevDistPoint)
        // we assume that elevation data is not that precise and we can improve when using a minimum distance:
        if (distForSlope > 100) {
            const slope = (100.0 * Math.abs(prevElePoint[2] - currPoint[2])) / distForSlope
            if (slope > steepSlope) {
                const distanceTxt = metersToShortText(Math.round(distForSlope), showDistanceInMiles)
                info.values.push(distanceTxt + ' (' + Math.round(slope) + '%)')
                info.distance += distForSlope
                info.segments.push(segmentPoints)
            }
            prevElePoint = currPoint
            distForSlope = 0
            segmentPoints = []
        }
        prevDistPoint = currPoint
        segmentPoints.push(toCoordinate(currPoint))
    })
    return info
}

function pad(value: number) {
    return value < 10 ? '0' + value : '' + value
}

function RoutingResultPlaceholder() {
    return (
        <div className={styles.resultRow}>
            <div className={styles.placeholderContainer}>
                <div className={styles.placeholderMain} />
                <div className={styles.placeholderMain + ' ' + styles.placeholderSecondary} />
            </div>
        </div>
    )
}

function hasPendingRequests(subRequests: SubRequest[]) {
    return subRequests.some(req => req.state === RequestState.SENT)
}

function getLength(paths: SegmentedPath[], subRequests: SubRequest[]) {
    if (subRequests.length > 0 && hasPendingRequests(subRequests)) {
        // consider maxAlternativeRoutes only for subRequests that are not yet returned, i.e. state === SENT
        // otherwise it can happen that too fast alternatives reject the main request leading to stale placeholders
        return Math.max(
            paths.length,
            ...subRequests
                .filter(request => request.state === RequestState.SENT)
                .map(request => request.args.maxAlternativeRoutes)
        )
    }
    return paths.length
}

function createSingletonListContent(props: RoutingResultsProps) {
    // if (props.paths.length > 0)
        // return <RoutingResult path={props.selectedPath} isSelected={true} profile={props.profile} info={props.info} />
    if (hasPendingRequests(props.currentRequest.subRequests)) return <RoutingResultPlaceholder key={1} />
    return ''
}

function createListContent({ paths, currentRequest, selectedPath, profile }: RoutingResultsProps) {
    const length = getLength(paths, currentRequest.subRequests)
    const result = []

    for (let i = 0; i < length; i++) {
        if (i < paths.length)
            result.push(
                <RoutingResult
                    key={i}
                    path={paths[i]}
                    isSelected={paths[i] === selectedPath}
                    profile={profile}
                />
            )
        else result.push(<RoutingResultPlaceholder key={i} />)
    }

    return result
}
