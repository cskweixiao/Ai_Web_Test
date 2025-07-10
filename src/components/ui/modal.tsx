"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Button } from "./button"
import { X } from "lucide-react"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  showCloseButton?: boolean
  closeOnClickOutside?: boolean
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  showCloseButton = true,
  closeOnClickOutside = true,
  size = "md",
}: ModalProps) {
  // Handle ESC key
  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    
    if (isOpen) {
      window.addEventListener("keydown", handleEsc)
    }
    
    return () => {
      window.removeEventListener("keydown", handleEsc)
    }
  }, [isOpen, onClose])

  // Size classes
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    full: "max-w-[95vw] w-full"
  }

  return (
    <Dialog open={isOpen} onOpenChange={closeOnClickOutside ? onClose : undefined}>
      <DialogContent 
        className={`${sizeClasses[size]} overflow-hidden`}
        onInteractOutside={(e) => {
          if (!closeOnClickOutside) {
            e.preventDefault()
          }
        }}
      >
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        
        {showCloseButton && (
          <div className="absolute right-4 top-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6 p-0 rounded-full"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="py-4 px-1">{children}</div>
        
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

export interface ConfirmModalProps extends Omit<ModalProps, "footer"> {
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  variant?: "default" | "destructive"
  isLoading?: boolean
}

export function ConfirmModal({
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  variant = "default",
  isLoading = false,
  ...props
}: ConfirmModalProps) {
  return (
    <Modal
      {...props}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button
            variant="outline"
            onClick={props.onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      }
    />
  )
} 