#!/usr/bin/python3

from ZoteroLocaleMerge import ZoteroLocaleMerge
import os
merger = ZoteroLocaleMerge.ZoteroLocaleMerge()

print ("Merging locales ...")
merger.merge()
print ("  done")
