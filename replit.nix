{ pkgs }: {
	deps = [
		pkgs.nodejs_18
		pkgs.nodePackages.nodemon
		pkgs.nodePackages.yarn
	];

	env = {
		NODE_ENV = "production";
	};
}