# Juris-M

[![Build Status](https://travis-ci.org/Juris-M/zotero.svg?branch=jurism-5.0)](https://travis-ci.org/Juris-M/zotero)

[Juris-M](https://juris-m.github.io/) is a modified version of Zotero, with support for multilingual and legal citation styles.

--------------

## From the Zotero README

[Zotero](https://www.zotero.org/) is a free, easy-to-use tool to help you collect, organize, cite, and share your research sources.

Please post feature requests or bug reports to the [Zotero Forums](https://forums.zotero.org/). If you're having trouble with Zotero, see [Getting Help](https://www.zotero.org/support/getting_help).

For more information on how to use this source code, see the [Zotero wiki](https://www.zotero.org/support/dev/source_code).

--------------

## About this repository and its friends

This repository contains the core Juris-M code module, and a test suite to validate that both the original features of Zotero and the extended functionality of Juris-M are working correctly. If you are working with Juris-M code, you will use this repository for two purposes: to build the module for inclusion in a standalone client; and to run the test suite. Procedures for both are outlined below.

## Cloning the repository

Several repositories are needed to build the Juris-M standalone client, so the keep things tidy, create an empty subdirectory, enter it, and clone this respository into it with the name ``jurism``, using commands like the following:
```bash
  prompt> mkdir jurism-repos
  prompt> cd jurism-repos
  prompt> git clone --recursive https://github.com/Juris-M/zotero.git jurism
```
If (as I often do) you forget to include the ``--recursive`` option when cloning, pull in the submodules by entering the repository directory and issuing commands like the following:
```bash
  prompt> cd jurism
  prompt> git submodule init
  prompt> git submodule update --remote
```
(Note that the directory name should be *jurism*. Both the build instructions and the build scripts for Juris-M assume that the repository has this name. If you first clone it as ``zotero`` or some other name, you can just rename it in the usual way.)


## ``node`` dependencies

To build the module, you will need to have recent versions of [node](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed. The versions available through the package manager for your operation system will probably do the job. Once you have ``npm`` installed, set up the dependencies by executing the following command in this directory:
```bash
  prompt> npm install
```

After setting up the dependencies, you can build the module with this command:
```bash
  prompt> node ./scripts/build.js
```

The script should create a ``./build`` subdirectory and populate it with the module code.

## Running tests

The test suite was added to the upstream Zotero source repository at the threshold of Zotero 5.0. The tests have been adapted in the Juris-M repository to exercise the extended fields and other features needed to manage multilingual and legal references. Every test should pass.

To run tests, you will need a compatible version of Firefox on your system. The version that you need depends on your operating system.

-   **Mac:** Use an [unbranded build of version 54.0](http://archive.mozilla.org/pub/firefox/tinderbox-builds/mozilla-release-macosx64-add-on-devel/1496944705/firefox-54.0.en-US.mac-add-on-devel.dmg)
-   **Linux:** Use [version 52.0.1esr](https://ftp.mozilla.org/pub/firefox/releases/52.0esr/linux-i686/en-US/firefox-52.0esr.tar.bz2)
-   **Windows:** Use [version 52.0.1esr](https://ftp.mozilla.org/pub/firefox/releases/52.0esr/win64/en-US/Firefox%20Setup%2052.0esr.exe)

(I *think* that these are right. If you have trouble working with any of them, let me know.)

To avoid profile corruption you should set up a separate profile for this *nightly* version that is separate from your regular Firefox profile, see the [mozilla instructions](https://support.mozilla.org/en-US/kb/using-dedicated-profile-firefox-nightly).

macOS users will also need to allow the nightly build to run as an unsigned application. After you start the client for the first time, you will see a SIP warning, then go to:
-   System Preferences -> Security and Privacy
-   click on "open anyway"
-   start nightly again and click open

Once you have a suitable Firefox in place, create a file at ``./test/runtests-custom.sh`` with the following line, adjusting the path to point at the appropriate Firefox in your filesystem:
```txt
   FX_EXECUTABLE="/path/to/your/firefox"
```
Enter the ``./test`` subdirectory, and try a test:
```bash
  prompt> ./runtests.sh -b notifierTest.js
```
The first time it is run, the ``runtests.sh`` script will download the ``pdftools`` bundle, after which the test should succeed. For full details on the use of the test runner, run the script with the ``-h`` option:
```bash
  prompt> ./runtests.sh -h
```

## Building the standalone client

To build a running standalone client using the module code, you will clone two repositories as siblings (not children) to the ``jurism`` directory:
```bash
  prompt> git clone --recursive https://github.com/Juris-M/zotero-build.git
  prompt> git clone --recursive https://github.com/Juris-M/zotero-standalone-build.git
```
Build steps must be performed in each of these repositories to yield a client installer. See their respective ``README`` files for details.
