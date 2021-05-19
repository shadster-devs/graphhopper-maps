import ApiInfoStore from '../../src/stores/ApiInfoStore'
import { InfoReceived } from '../../src/actions/Actions'
import { ApiInfo } from '../../src/api/graphhopper'

describe('ApiInfoStore', () => {
    it('should accept an InfoReceived action and store its result', () => {
        const state: ApiInfo = {
            profiles: [],
            version: '',
            import_date: '',
            elevation: true,
            bbox: [0, 0, 0, 0],
        }
        const receivedInfo: ApiInfo = {
            bbox: [1, 1, 1, 1],
            import_date: 'some-date',
            version: 'some-version',
            elevation: true,
            profiles: [{ key: 'some-profile' }],
        }
        const store = new ApiInfoStore()

        const newState = store.reduce(state, new InfoReceived(receivedInfo))

        expect(newState).toEqual(receivedInfo)
    })
    it('should not alter the state if unknown actions are passed', () => {
        const state: ApiInfo = {
            profiles: [],
            elevation: false,
            version: '',
            import_date: '',
            bbox: [0, 0, 0, 0],
        }
        const store = new ApiInfoStore()

        const newState = store.reduce(state, {})

        expect(newState).toEqual(state)
    })
})
