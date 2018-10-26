# Refresh my computer every year

Backup myself and go on again.

# What for backup

1. The ssh keys and passwords for logining matchines
2. The shadowsocks config file and extra tools for cross the G·F·W
3. The bookmarks

Then I use the commands to backup:

```
$ cd ~
$ mkdir backups
$ cp -af .ssh backups/dot.ssh
$ cp -af bin/cow backups
$ cp -af .cow backups/dot.cow
$ cp -af /etc/shadowsocks backups/shadowsocks
```

After backup and I encrypt the files, then send to my email for saving.

By the article I known the zip command is safe enough with long password.
And how to encrypt and decrypt zip files.

1. https://www.quora.com/How-secure-are-encrypted-Zip-files
2. https://www.shellhacks.com/create-password-protected-zip-file-linux/

```
$ zip --encrypt -r backups.zip backups
$ mkdir decrypt
$ cp -af backups.zip decrypt
$ cd decrypt
$ unzip backups.zip
```

Don't forget save the zip file to email.

# Setup OS

I would like to use Ubuntu without macbook pro.

Download the ISO file from the official webiste cn.ubuntu.com.

http://releases.ubuntu.com/18.10/ubuntu-18.10-desktop-amd64.iso

It takes almost half an hour.

And prepare a USB for installation.

Use dd for setup ISO file.

```
$ sudo fdisk -l
$ sudo dd if=ubuntu-18.10-desktop-amd64.iso of=/dev/sdb
```
