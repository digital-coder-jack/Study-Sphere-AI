package com.ainotebook.app

import android.app.Application
import com.ainotebook.app.data.ApiClient
import com.ainotebook.app.data.NetworkMonitor
import com.ainotebook.app.data.Repository
import com.ainotebook.app.data.SessionStore
import com.ainotebook.app.data.ThemePreferences

/**
 * Application class that wires up the singletons (session store, API client,
 * repository) used across the app.
 */
class AiNotebookApp : Application() {

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
        lateinit var instance: AiNotebookApp
            private set
    }
}
