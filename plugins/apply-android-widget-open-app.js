/**
 * Re-applies the Glance root clickable so tapping an Android home widget opens Trackwise.
 * expo-widgets 58 does not map widgetURL on Android; this patches toPeekRoot in the package.
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'trackwise-open-app';

const IMPORT_INTENT = 'import android.content.Intent';
const IMPORT_URI = 'import android.net.Uri';
const IMPORT_START =
  'import androidx.glance.appwidget.action.actionStartActivity';

const ORIGINAL_ROOT = `internal fun ReadableMap.toPeekRoot(context: Context, source: InteractionSource, size: DpSize): Emittable {
  val converterContext = WidgetConverterContext(context, size)
  return EmittableColumn().also { root ->
    root.children += toPeekNodes(converterContext, source)
  }
}`;

const PATCHED_ROOT = `internal fun ReadableMap.toPeekRoot(context: Context, source: InteractionSource, size: DpSize): Emittable {
  val converterContext = WidgetConverterContext(context, size)
  // ${MARKER}: whole-widget tap opens the app via snapshot openUrl.
  val openUrl = (source as? InteractionSource.Widget)
    ?.let { WidgetsLayoutRegistry.props(context, it.name)?.get("openUrl") as? String }
    ?.takeIf { it.isNotBlank() }
    ?: "trackwise:///"
  val launchIntent = Intent(Intent.ACTION_VIEW, Uri.parse(openUrl)).apply {
    \`package\` = context.packageName
    addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP
    )
  }
  return EmittableColumn().also { root ->
    root.modifier = GlanceModifier.clickable(actionStartActivity(launchIntent))
    root.children += toPeekNodes(converterContext, source)
  }
}`;

function treePath(projectRoot) {
  return path.join(
    projectRoot,
    'node_modules/expo-widgets/android/src/main/java/expo/modules/widgets/ExpoWidgetEmittableTree.kt',
  );
}

function applyPatch(projectRoot) {
  const filePath = treePath(projectRoot);
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(MARKER)) return true;

  if (!source.includes(IMPORT_INTENT)) {
    source = source.replace(
      'import android.content.Context\n',
      `import android.content.Context\n${IMPORT_INTENT}\n`,
    );
  }
  if (!source.includes(IMPORT_URI)) {
    source = source.replace(
      'import android.graphics.Color as AndroidColor\n',
      `import android.graphics.Color as AndroidColor\n${IMPORT_URI}\n`,
    );
  }
  if (!source.includes(IMPORT_START)) {
    source = source.replace(
      'import androidx.glance.action.clickable\n',
      `import androidx.glance.action.clickable\n${IMPORT_START}\n`,
    );
  }

  if (!source.includes(ORIGINAL_ROOT)) {
    throw new Error(
      'Could not patch expo-widgets toPeekRoot; the upstream function no longer matches.',
    );
  }
  source = source.replace(ORIGINAL_ROOT, PATCHED_ROOT);
  fs.writeFileSync(filePath, source);
  return true;
}

function withAndroidWidgetOpenApp(config) {
  const { withDangerousMod } = require('expo/config-plugins');
  return withDangerousMod(config, [
    'android',
    (mod) => {
      applyPatch(mod.modRequest.projectRoot);
      return mod;
    },
  ]);
}

if (require.main === module) {
  applyPatch(path.resolve(__dirname, '..'));
}

module.exports = withAndroidWidgetOpenApp;
module.exports.applyPatch = applyPatch;
