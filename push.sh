#!/bin/bash

set -e

##
## Tag releases manually.
##
#TAG=$(grep '<em:version' install.rdf | sed -e 's/.*>\(.*\)<.*/\1/' | sed -e 's/\.SOURCE//')
#git tag $TAG
#git push --tags

if [ "" = "$1" ]; then
  echo Set branch name as first argument
  exit 1
fi
BRANCH="$1"

# Check node version
VERSION=$(node --version)
if [ "$VERSION" != "v14.21.3" ]; then
    echo Node $VERSION detected, but the Jurism 6 build chain wants node v14.21.3.
    echo \(To juggle multiple node version nvm is your friend.\)
   exit 0
fi

SOURCE_REPO_URL="https://github.com/Juris-M/zotero"
CI_ZIP="ci/client"

branch="$BRANCH"

HASH=$(git ls-remote --exit-code $SOURCE_REPO_URL $branch | cut -f 1)

if [ "" = "$HASH" ]; then
	echo Remote branch does not exist, apparently
	exit 1
fi

git checkout $HASH


##
# Very slightly fancy here
##

set +e
dialog --no-lines --title "Push code for client build" --yesno "Do you trust the content of\nthis ./build directory?"  8 35;

if [ "$?" == 0 ]; then
    REBUILD=0
else
    REBUILD=1
fi

set -e

clear

echo -n Okay .
sleep 2
echo -n .
sleep 2
echo -n .
sleep 2

echo All righty then.

if [ $REBUILD -eq 1 ]; then
    echo Rebuilding from scratch. This will take some time.
    sleep 2
    rm -fR build
    rm -f .signatures.json
    node ./scripts/build.js
else
    echo Trusting the current build. Pushing to remote repo.
fi

##
# End of fancy stuff
##

cd build

zip -r $HASH.zip *

cd ..

node ./deployer/index.js -u ./build/"$HASH.zip" "$CI_ZIP"/"$HASH.zip"

rm ./build/"$HASH.zip"

git checkout "$BRANCH"

echo "Pushed $HASH"
