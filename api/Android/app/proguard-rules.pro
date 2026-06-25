# Keep kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.ainotebook.app.**$$serializer { *; }
-keepclassmembers class com.ainotebook.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.ainotebook.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
