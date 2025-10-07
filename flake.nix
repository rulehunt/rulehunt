{
  description = "Development environment with pnpm";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-darwin";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          nodejs_22
          pnpm
        ];

        shellHook = ''
          echo "Development environment loaded"
          echo "Node: $(node --version)"
          echo "pnpm: $(pnpm --version)"
        '';
      };
    };
}