import styles from './SettingsMenu.module.css'
import { UpdateSettings } from '@/actions/Actions'
import Dispatcher from '@/stores/Dispatcher'
import { PathDisplayMode, Settings } from '@/stores/SettingsStore'

export default function SettingsMenu({ settings }: { settings: Settings }) {
    return (
        <div className={styles.settingsMenu}>
            <h3>Settings</h3>
            
            <div className={styles.settingItem}>
                <label htmlFor="showDistanceInMiles">Show distances in miles</label>
                <input
                    type="checkbox"
                    id="showDistanceInMiles"
                    checked={settings.showDistanceInMiles}
                    onChange={e => {
                        Dispatcher.dispatch(
                            new UpdateSettings({
                                showDistanceInMiles: e.target.checked,
                            })
                        )
                    }}
                />
            </div>
            
            <div className={styles.settingItem}>
                <label htmlFor="showAnimations">Show animated transport icons</label>
                <input
                    type="checkbox"
                    id="showAnimations"
                    checked={settings.showAnimations}
                    onChange={e => {
                        Dispatcher.dispatch(
                            new UpdateSettings({
                                showAnimations: e.target.checked,
                            })
                        )
                    }}
                />
            </div>
            
            <div className={styles.settingItem}>
                <label htmlFor="pathDisplayMode">Path display mode</label>
                <select
                    id="pathDisplayMode"
                    value={settings.pathDisplayMode}
                    onChange={e => {
                        Dispatcher.dispatch(
                            new UpdateSettings({
                                pathDisplayMode: e.target.value as PathDisplayMode,
                            })
                        )
                    }}
                >
                    <option value={PathDisplayMode.Dynamic}>Dynamic (animated)</option>
                    <option value={PathDisplayMode.Static}>Status (static)</option>
                </select>
            </div>
        </div>
    )
} 