import { QueryPoint } from '@/stores/QueryStore';
import Dispatcher from '@/stores/Dispatcher';
import { SetPoint } from '@/actions/Actions';

function selectGeocodingItem(item: any, point: QueryPoint) {
    Dispatcher.dispatch(
        new SetPoint(
            {
                ...point,
                coordinate: { lat: item.point.lat, lng: item.point.lng },
                queryText: item.name,
                isInitialized: true,
                sarathiLocation: item.sarathiLocation ? {
                    id: item.sarathiLocation.id,
                    sid: item.sarathiLocation.sid,
                    type: item.sarathiLocation.type,
                    name: item.sarathiLocation.name,
                    cc: item.sarathiLocation.cc
                } : undefined
            },
            true
        )
    );
} 