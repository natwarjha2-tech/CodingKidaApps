/**
 * Expo config plugin: pin androidx.media3 (ExoPlayer) to a single version.
 *
 * WHY THIS EXISTS
 * ---------------
 * `expo-audio` hardcodes androidx.media3 1.9.0, while `react-native-video`
 * 6.19.2 is only source-compatible with media3 1.8.0 (its RNVLoadControl uses
 * the 1.8.0 DefaultLoadControl constructor + getAllocator() with no args — both
 * changed in 1.9.0). With both installed, Gradle resolves media3 to 1.9.0 and
 * react-native-video fails to compile (NoSuchMethod / constructor mismatch).
 *
 * This plugin makes the fix DURABLE across `expo prebuild` (which regenerates
 * the git-ignored android/ folder and would otherwise wipe a manual edit). It:
 *   1. sets `ext.media3Version = "1.8.0"` so react-native-video builds on 1.8.0
 *      (react-native-video reads rootProject.ext.media3Version first), and
 *   2. forces every `androidx.media3:*` artifact to 1.8.0 across all modules so
 *      expo-audio's hardcoded 1.9.0 is pinned down to match.
 *
 * 1.8.0 is API-compatible for expo-audio's playback needs; this was verified to
 * build and run (video + audio) successfully.
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

const MEDIA3_VERSION = '1.8.0';
const MARKER = '// >>> media3-pin (withMedia3Version plugin)';

const SNIPPET = `
${MARKER}
ext {
  media3Version = "${MEDIA3_VERSION}"
}
allprojects {
  configurations.all {
    resolutionStrategy {
      eachDependency { details ->
        if (details.requested.group == "androidx.media3") {
          details.useVersion "${MEDIA3_VERSION}"
        }
      }
    }
  }
}
// <<< media3-pin
`;

module.exports = function withMedia3Version(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        'withMedia3Version: cannot pin media3 — root build.gradle is not Groovy.'
      );
    }
    // Idempotent: don't add the block twice if prebuild runs repeatedly.
    if (cfg.modResults.contents.includes(MARKER)) {
      return cfg;
    }
    // Inject right before the expo-root-project plugin apply (end of file is fine
    // too, but placing it early ensures ext is set before modules resolve).
    const anchor = 'apply plugin: "expo-root-project"';
    if (cfg.modResults.contents.includes(anchor)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        anchor,
        `${SNIPPET}\n${anchor}`
      );
    } else {
      cfg.modResults.contents += `\n${SNIPPET}\n`;
    }
    return cfg;
  });
};
