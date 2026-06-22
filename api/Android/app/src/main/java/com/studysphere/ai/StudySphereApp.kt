package com.studysphere.ai

import android.app.Application
import com.studysphere.ai.data.ApiClient
import com.studysphere.ai.data.NetworkMonitor
import com.studysphere.ai.data.Repository
import com.studysphere.ai.data.SessionStore
import com.studysphere.ai.data.ThemePreferences

/**
 * Application class that wires up the singletons (session store, API client,
 * repository) used across the app.
 */
class StudySphereApp : Application() {

    lateinit var session: SessionStore
        private set
    lateinit var repository: Repository
        private set
    lateinit var themePrefs: ThemePreferences
        private set
    lateinit var networkMonitor: NetworkMonitor
        private set

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
        ApiClient.init(session)
        repository = Repository(session)
        themePrefs = ThemePreferences(this)
        networkMonitor = NetworkMonitor(this)
        instance = this
    }

    companion object {
        lateinit var instance: StudySphereApp
            private set
    }
}
