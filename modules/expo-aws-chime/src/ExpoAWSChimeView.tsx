import { requireNativeViewManager } from "expo-modules-core";
import * as React from "react";
import { PureComponent } from "react";
import { View, ViewProps } from "react-native";

export type ExpoAWSChimeViewProps = {
  tileId: number;
  isLocal?: boolean;
  /** Show the whole frame without cropping (use for screen share). Needs the rebuilt native module. */
  fit?: boolean;
} & ViewProps;

// Resolved lazily (first render) and guarded, so importing this file never
// crashes the app when the native module is missing from the build.
let NativeView: React.ComponentType<ExpoAWSChimeViewProps> | null | undefined;
function getNativeView() {
  if (NativeView === undefined) {
    try {
      NativeView = requireNativeViewManager("ExpoAWSChime");
    } catch {
      NativeView = null;
    }
  }
  return NativeView;
}

export default class ExpoAWSChimeView extends PureComponent<ExpoAWSChimeViewProps> {
  render() {
    const { tileId, isLocal, fit, ...rest } = this.props;
    const Native = getNativeView();
    return (
      <View {...rest}>
        {Native ? (
          <Native style={{ width: "100%", height: "100%" }} tileId={tileId} isLocal={isLocal} fit={!!fit} />
        ) : null}
      </View>
    );
  }
}
