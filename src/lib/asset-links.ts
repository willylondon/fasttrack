/** Digital Asset Links statement that lets the Android app open this site full screen. */
export function buildAssetLinks(packageName?: string, fingerprints?: string) {
  const certificates = (fingerprints ?? "")
    .split(",")
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter(Boolean);

  if (!packageName?.trim() || !certificates.length) {
    return [];
  }

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName.trim(),
        sha256_cert_fingerprints: certificates,
      },
    },
  ];
}
