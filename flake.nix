{
  description = "Anicord dashboard frontend.";
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forEachSystem =
        f: nixpkgs.lib.genAttrs systems (system: f { pkgs = import nixpkgs { inherit system; }; });
    in
    {
      packages = forEachSystem (
        { pkgs }:
        {
          default = pkgs.buildNpmPackage {
            pname = "anicord-webserver";
            version = "latest";
            src = ./.;
            npmDepsHash = "sha256-rapuHgPvXBVU8B2Buql0iomMM0ah69F1gAkNCcmGWmY=";
            nativeBuildInputs = [ pkgs.nodejs ];
            buildPhase = "npm run build";
            installPhase = ''
              mkdir -p $out
              cp -r . $out/
            '';
          };
        }
      );

      devShells = forEachSystem (
        { pkgs }:
        {
          default = pkgs.mkShell { buildInputs = [ pkgs.nodejs ]; };
        }
      );
    };
}
