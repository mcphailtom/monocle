package main

import (
	"fmt"
	"os"

	"github.com/josephschmitt/monocle/desktop"
)

func main() {
	if err := desktop.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
