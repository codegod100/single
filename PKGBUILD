# Maintainer: Nandi <nandi@example.com>
pkgname=single-bin
pkgver=1.0.1
pkgrel=1
pkgdesc="A single-tab Chromium-based browser with extension support."
arch=('x86_64')
url="https://github.com/codegod100/single"
license=('GPL3')
depends=('fuse2' 'gtk3' 'nss' 'libxss' 'libxtst' 'at-spi2-core')
options=(!strip)
source=("https://github.com/codegod100/single/releases/download/v$pkgver/Single-$pkgver.AppImage")
sha256sums=('SKIP')

prepare() {
  chmod +x "Single-$pkgver.AppImage"
  ./"Single-$pkgver.AppImage" --appimage-extract
}

package() {
  install -dm755 "$pkgdir/opt/$pkgname"
  cp -rp "$srcdir/squashfs-root/"* "$pkgdir/opt/$pkgname/"
  
  # Remove AppImage specific files
  rm "$pkgdir/opt/$pkgname/AppRun"
  
  install -dm755 "$pkgdir/usr/bin"
  ln -s "/opt/$pkgname/single" "$pkgdir/usr/bin/single"
  
  # Desktop file
  install -dm755 "$pkgdir/usr/share/applications"
  cp "$srcdir/squashfs-root/single.desktop" "$pkgdir/usr/share/applications/single.desktop"
  
  # Icons
  install -dm755 "$pkgdir/usr/share/icons/hicolor/512x512/apps"
  cp "$srcdir/squashfs-root/single.png" "$pkgdir/usr/share/icons/hicolor/512x512/apps/single.png"
}
