# Fix LD_LIBRARY_PATH for apt-installed Chrome dependencies
# The jemalloc buildpack's profile.d script overwrites LD_LIBRARY_PATH,
# dropping the apt buildpack's paths. This .profile runs AFTER all
# .profile.d scripts and re-adds the apt library path.
if [ -d "$HOME/.apt/usr/lib/x86_64-linux-gnu" ]; then
  export LD_LIBRARY_PATH="$HOME/.apt/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
fi
