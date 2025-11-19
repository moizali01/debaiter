type LinkModalProp = {
	isOpen: boolean,
	opponentLink: string
}

function LinkModal({ isOpen, opponentLink }: LinkModalProp) {
  if (!isOpen) return null; // Don't render the modal if it's not open.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-lg">
      <div className="relative w-full max-w-lg p-6 bg-white rounded-lg shadow-lg dark:bg-zinc-900">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Share this link with your opponent
        </h2>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300 break-words">
          Here's the link:
          <a
            href={opponentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-600"
          >
            {opponentLink}
          </a>
        </p>
      </div>
    </div>
  );
}



export default LinkModal
