#!/usr/bin/python

from ZoteroLocaleMerge import ZoteroLocaleMerge
import os
merger = ZoteroLocaleMerge.ZoteroLocaleMerge()

print ("Merging locales ...")
merger.merge()
print ("  done")
